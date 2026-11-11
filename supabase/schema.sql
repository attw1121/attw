-- 報修登記系統：適用新建或既有資料表，可重複執行；請以資料庫管理者執行。
-- 保留資料，不刪表、不自動改寫既有資料；不相容的型態或資料會使整個交易回滾。
-- 文字長度與必填為設計選擇：姓名 100 字、地點 200 字、說明 2000 字。
BEGIN;

-- 建立空表（已存在時略過），再逐一補上缺少的欄位。
CREATE TABLE IF NOT EXISTS public.repair_requests ();
ALTER TABLE public.repair_requests
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS reporter_name text,
    ADD COLUMN IF NOT EXISTS location text,
    ADD COLUMN IF NOT EXISTS category text,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS urgency text DEFAULT '中',
    ADD COLUMN IF NOT EXISTS status text DEFAULT '待處理';

-- 在交易內鎖定資料表，避免檢查及設定安全規則期間有其他寫入。
LOCK TABLE public.repair_requests IN ACCESS EXCLUSIVE MODE;

-- 不猜測或強制轉換舊型態；不相容時提供明確錯誤，交由管理者確認。
DO $$
DECLARE
    item record;
BEGIN
    FOR item IN
        SELECT a.attname, a.atttypid
        FROM pg_attribute AS a
        WHERE a.attrelid = 'public.repair_requests'::regclass
          AND a.attnum > 0 AND NOT a.attisdropped
    LOOP
        IF (item.attname = 'id' AND item.atttypid <> 'uuid'::regtype)
           OR (item.attname = 'created_at' AND item.atttypid <> 'timestamptz'::regtype)
           OR (item.attname IN ('reporter_name', 'location', 'category', 'description', 'urgency', 'status')
               AND item.atttypid NOT IN ('text'::regtype, 'varchar'::regtype)) THEN
            RAISE EXCEPTION '欄位 % 的型態不相容；請先確認既有結構，未自動轉換資料。', item.attname;
        END IF;
    END LOOP;
END;
$$;

-- 統一預設值與必填；若舊資料存在 NULL，則安全失敗，不擅自填造資料。
ALTER TABLE public.repair_requests
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN created_at SET DEFAULT now(),
    ALTER COLUMN urgency SET DEFAULT '中',
    ALTER COLUMN status SET DEFAULT '待處理',
    ALTER COLUMN id SET NOT NULL,
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN reporter_name SET NOT NULL,
    ALTER COLUMN location SET NOT NULL,
    ALTER COLUMN category SET NOT NULL,
    ALTER COLUMN description SET NOT NULL,
    ALTER COLUMN urgency SET NOT NULL,
    ALTER COLUMN status SET NOT NULL;

-- 確保主鍵只使用 id；遇到其他既有主鍵時停止，不移除它或其相依關係。
DO $$
DECLARE
    id_number smallint;
    existing_key smallint[];
BEGIN
    SELECT attnum INTO id_number FROM pg_attribute
    WHERE attrelid = 'public.repair_requests'::regclass AND attname = 'id';
    SELECT conkey INTO existing_key FROM pg_constraint
    WHERE conrelid = 'public.repair_requests'::regclass AND contype = 'p';
    IF existing_key IS NULL THEN
        ALTER TABLE public.repair_requests ADD PRIMARY KEY (id);
    ELSIF existing_key <> ARRAY[id_number] THEN
        RAISE EXCEPTION '既有主鍵不是單一 id 欄位；請先確認結構。';
    END IF;
END;
$$;

-- CHECK：重建本檔管理的限制，並驗證全部舊資料；無效資料會使交易回滾。
ALTER TABLE public.repair_requests
    DROP CONSTRAINT IF EXISTS repair_requests_reporter_name_check,
    DROP CONSTRAINT IF EXISTS repair_requests_location_check,
    DROP CONSTRAINT IF EXISTS repair_requests_description_check,
    DROP CONSTRAINT IF EXISTS repair_requests_category_check,
    DROP CONSTRAINT IF EXISTS repair_requests_urgency_check,
    DROP CONSTRAINT IF EXISTS repair_requests_status_check,
    ADD CONSTRAINT repair_requests_reporter_name_check
        CHECK (char_length(reporter_name) BETWEEN 1 AND 100 AND reporter_name ~ '[^[:space:]]'),
    ADD CONSTRAINT repair_requests_location_check
        CHECK (char_length(location) BETWEEN 1 AND 200 AND location ~ '[^[:space:]]'),
    ADD CONSTRAINT repair_requests_description_check
        CHECK (char_length(description) BETWEEN 1 AND 2000 AND description ~ '[^[:space:]]'),
    ADD CONSTRAINT repair_requests_category_check CHECK (category IN ('設備', '網路', '環境', '其他')),
    ADD CONSTRAINT repair_requests_urgency_check CHECK (urgency IN ('低', '中', '高')),
    ADD CONSTRAINT repair_requests_status_check CHECK (status IN ('待處理', '處理中', '已完成'));

-- GRANT：先清除公開及客戶端角色的資料表權限，再明確給予匿名角色最小權限。
-- 此專案不會自動授權新表；不可只建立 RLS 政策而省略 GRANT。
REVOKE ALL PRIVILEGES ON TABLE public.repair_requests
    FROM PUBLIC, anon, authenticated;
-- 舊的欄位級授權不會隨資料表級 REVOKE 清除，因此逐欄撤銷（包含額外舊欄位）。
DO $$
DECLARE
    column_list text;
BEGIN
    SELECT string_agg(quote_ident(attname), ', ') INTO column_list
    FROM pg_attribute
    WHERE attrelid = 'public.repair_requests'::regclass AND attnum > 0 AND NOT attisdropped;
    EXECUTE format(
        'REVOKE ALL PRIVILEGES (%s) ON TABLE public.repair_requests FROM PUBLIC, anon, authenticated',
        column_list
    );
END;
$$;

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON TABLE public.repair_requests TO anon;

-- GRANT：匿名新增只接受填表所需欄位；不准指定 id、created_at、status。
-- 狀態由預設值產生；不授予 UPDATE、DELETE 或 TRUNCATE 等權限。
GRANT INSERT (reporter_name, location, category, description, urgency)
    ON TABLE public.repair_requests TO anon;

-- RLS：啟用資料列安全，並要求一般資料表擁有者也遵守政策。
-- 超級使用者或具有 BYPASSRLS 的角色（例如服務角色）仍可略過 RLS。
ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_requests FORCE ROW LEVEL SECURITY;

-- 清除本表舊政策，避免既有寬鬆政策以 OR 合併而繞過新的新增限制。
-- 本檔完整管理此示範資料表的政策；自訂政策須另行審閱後納入。
DO $$
DECLARE
    policy_record record;
BEGIN
    FOR policy_record IN SELECT polname FROM pg_policy
        WHERE polrelid = 'public.repair_requests'::regclass
    LOOP
        EXECUTE format('DROP POLICY %I ON public.repair_requests', policy_record.polname);
    END LOOP;
END;
$$;

-- RLS：任何取得 SELECT 權限的角色都能讀取全部清單；政策本身不授予權限。
-- 目前僅 anon 取得客戶端權限，登入後的 authenticated 角色未獲授權。
CREATE POLICY repair_requests_public_read
    ON public.repair_requests
    FOR SELECT TO PUBLIC
    USING (true);

-- RLS：任何取得 INSERT 權限的角色新增時，狀態都只能是「待處理」。
-- 即使日後誤授 status 的 INSERT 權限，本政策仍會阻擋其他初始狀態。
CREATE POLICY repair_requests_pending_insert
    ON public.repair_requests
    FOR INSERT TO PUBLIC
    WITH CHECK (status = '待處理');

-- RLS：不建立 UPDATE 或 DELETE 政策，配合未授權限禁止公開客戶端修改及刪除。
COMMIT;
