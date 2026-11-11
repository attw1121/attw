import zipfile, xml.etree.ElementTree as ET
from pathlib import Path
p=Path(__file__).parent/'範例計算書.xlsx'
with zipfile.ZipFile(p) as z:
    assert z.testzip() is None
    for name in z.namelist(): ET.fromstring(z.read(name))
    ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    book=ET.fromstring(z.read('xl/workbook.xml'))
    assert len(book.find('m:sheets',ns))==4
    sheet=ET.fromstring(z.read('xl/worksheets/sheet2.xml'))
    formulas=sheet.findall('.//m:f',ns)
    assert len(formulas)==8
    values={c.attrib['r']:float(c.find('m:v',ns).text) for c in sheet.findall('.//m:c',ns) if c.find('m:v',ns) is not None}
    assert abs(values['F2']-21560)<1e-7
    assert abs(values['G2']/values['F2']-values['H2'])<1e-12
print('XLSX PASS: ZIP CRC, all XML, 4 worksheets, 8 formulas and cached values')
