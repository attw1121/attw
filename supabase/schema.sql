-- 報修登記系統：供 Supabase 專案首次建表使用；本檔僅供審閱，尚未執行。
-- 文字長度與必填為本次設計選擇：姓名 100 字、地點 200 字、說明 2000 字。
-- 使用交易確保建表、權限與政策一起生效；重複執行會因資料表已存在而失敗。
BEGIN;

-- 建立資料表：識別碼與建立時間由伺服器產生，所有業務欄位皆必填。
CREATE TABLE public.repair_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    reporter_name text NOT NULL,
    location text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    urgency text NOT NULL DEFAULT '中',
    status text NOT NULL DEFAULT '待處理',

    -- CHECK：依字元數限制文字，並拒絕空字串或全為空白的內容。
    CONSTRAINT repair_requests_reporter_name_check
        CHECK (char_length(reporter_name) BETWEEN 1 AND 100
               AND reporter_name ~ '[^[:space:]]'),
    CONSTRAINT repair_requests_location_check
        CHECK (char_length(location) BETWEEN 1 AND 200
               AND location ~ '[^[:space:]]'),
    CONSTRAINT repair_requests_description_check
        CHECK (char_length(description) BETWEEN 1 AND 2000
               AND description ~ '[^[:space:]]'),

    -- CHECK：類別、緊急程度及狀態只能使用指定選項；選項本身亦限定文字長度。
    CONSTRAINT repair_requests_category_check
        CHECK (category IN ('設備', '網路', '環境', '其他')),
    CONSTRAINT repair_requests_urgency_check
        CHECK (urgency IN ('低', '中', '高')),
    CONSTRAINT repair_requests_status_check
        CHECK (status IN ('待處理', '處理中', '已完成'))
);

-- GRANT：先清除公開及客戶端角色的資料表權限，再明確給予匿名角色最小權限。
-- 此專案不會自動授權新表；不可只建立 RLS 政策而省略 GRANT。
REVOKE ALL PRIVILEGES ON TABLE public.repair_requests
    FROM PUBLIC, anon, authenticated;
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
