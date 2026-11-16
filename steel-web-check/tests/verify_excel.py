"""Excel 公式驗證：產生多組案例 → 移除公式快取值 → LibreOffice 重算 → 與網頁計算值比對。

需求：Node.js、LibreOffice（soffice）、Python openpyxl。
用法：python3 steel-web-check/tests/verify_excel.py
"""
import glob, os, re, subprocess, sys, tempfile, zipfile
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))


def num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def main():
    work = tempfile.mkdtemp(prefix='webcheck_')
    src, out = os.path.join(work, 'in'), os.path.join(work, 'out')
    os.makedirs(src); os.makedirs(out)
    subprocess.run(['node', os.path.join(HERE, 'gen_excel_cases.js'), src], check=True)
    files = sorted(glob.glob(os.path.join(src, 'c*.xlsx')))
    for f in files:  # 去除快取值，迫使 LibreOffice 自行計算
        stripped = os.path.join(src, 's_' + os.path.basename(f))
        with zipfile.ZipFile(f) as zin, zipfile.ZipFile(stripped, 'w') as zout:
            for n in zin.namelist():
                d = zin.read(n)
                if n.startswith('xl/worksheets/'):
                    d = re.sub(rb'(</f>)<v>[^<]*</v>', rb'\1', d)
                zout.writestr(n, d)
    subprocess.run(['soffice', '--headless', '--calc', '--convert-to', 'xlsx', '--outdir', out] + glob.glob(os.path.join(src, 's_*.xlsx')),
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    total = bad = 0
    for f in files:
        name = os.path.basename(f)
        formulas = openpyxl.load_workbook(f)
        cached = openpyxl.load_workbook(f, data_only=True)
        recalc = openpyxl.load_workbook(os.path.join(out, 's_' + name), data_only=True)
        for sh in formulas.sheetnames:
            for row in formulas[sh].iter_rows():
                for cell in row:
                    if isinstance(cell.value, str) and cell.value.startswith('='):
                        total += 1
                        a, b = cached[sh][cell.coordinate].value, recalc[sh][cell.coordinate].value
                        ok = (num(b) and abs(a - b) <= 1e-7 * max(1, abs(a))) if num(a) else a == b
                        if not ok:
                            bad += 1
                            print(f'{name} {sh}!{cell.coordinate}: 網頁 {a!r} ≠ Excel {b!r}  {cell.value[:90]}')
    print(f'{len(files)} 個案例，{total} 個公式儲存格，{bad} 個不一致')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
