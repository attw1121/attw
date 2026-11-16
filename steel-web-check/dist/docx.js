/* 最小 DOCX 寫入器：段落、文字格式（含上下標）、表格、PNG 圖片、頁首頁尾與頁碼 */
(function (g) {
  'use strict';
  const { zip, xmlEsc: x } = g.MiniZip;
  const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1134;
  const CONTENT_W = PAGE_W - 2 * MARGIN; // twips

  function R(text, o = {}) {
    let pr = '';
    if (o.font) pr += '<w:rFonts w:ascii="' + o.font + '" w:hAnsi="' + o.font + '" w:cs="' + o.font + '"/>';
    if (o.b) pr += '<w:b/><w:bCs/>';
    if (o.i) pr += '<w:i/><w:iCs/>';
    if (o.color) pr += '<w:color w:val="' + o.color + '"/>';
    if (o.size) pr += '<w:sz w:val="' + Math.round(o.size * 2) + '"/><w:szCs w:val="' + Math.round(o.size * 2) + '"/>';
    if (o.sub) pr += '<w:vertAlign w:val="subscript"/>';
    if (o.sup) pr += '<w:vertAlign w:val="superscript"/>';
    if (o.shade) pr += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shade + '"/>';
    const parts = String(text ?? '').split('\n');
    return parts.map((t, i) => '<w:r>' + (pr ? '<w:rPr>' + pr + '</w:rPr>' : '') + (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + x(t) + '</w:t></w:r>').join('');
  }
  /* 公式標記 → runs：x_{sub}、x^{sup}、單字元可省略大括號 */
  function rich(s, o = {}) {
    let out = '', buf = '', i = 0;
    s = String(s ?? '');
    const flush = () => { if (buf) { out += R(buf, o); buf = ''; } };
    while (i < s.length) {
      const ch = s[i];
      if ((ch === '_' || ch === '^') && i + 1 < s.length) {
        flush();
        let body;
        if (s[i + 1] === '{') { const j = s.indexOf('}', i); body = s.slice(i + 2, j); i = j + 1; } else { body = s[i + 1]; i += 2; }
        out += R(body, Object.assign({}, o, ch === '_' ? { sub: true } : { sup: true }));
      } else { buf += ch; i++; }
    }
    flush();
    return out;
  }
  function P(content, o = {}) {
    let pr = '';
    if (o.style) pr += '<w:pStyle w:val="' + o.style + '"/>';
    if (o.keepNext) pr += '<w:keepNext/>';
    if (o.pageBreakBefore) pr += '<w:pageBreakBefore/>';
    if (o.shade) pr += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shade + '"/>';
    if (o.border) pr += '<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="' + o.border + '"/></w:pBdr>';
    if (o.before !== undefined || o.after !== undefined || o.line) pr += '<w:spacing' + (o.before !== undefined ? ' w:before="' + o.before + '"' : '') + (o.after !== undefined ? ' w:after="' + o.after + '"' : '') + (o.line ? ' w:line="' + o.line + '" w:lineRule="auto"' : '') + '/>';
    if (o.indent) pr += '<w:ind w:left="' + o.indent + '"' + (o.hanging ? ' w:hanging="' + o.hanging + '"' : '') + '/>';
    if (o.align) pr += '<w:jc w:val="' + o.align + '"/>';
    return '<w:p>' + (pr ? '<w:pPr>' + pr + '</w:pPr>' : '') + (content || '') + '</w:p>';
  }
  /* rows: [[cell]]；cell: string | {c: runsXml | text, shade, b, align, span, color, w} */
  function table(rows, o = {}) {
    const widths = o.widths || [];
    const total = widths.reduce((a, b) => a + b, 0) || CONTENT_W;
    const grid = '<w:tblGrid>' + widths.map(w => '<w:gridCol w:w="' + w + '"/>').join('') + '</w:tblGrid>';
    const bc = o.borderColor || 'A8B8B0';
    const borders = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="' + bc + '"/>').join('') + '</w:tblBorders>';
    const body = rows.map((row, ri) => {
      const isHead = o.header && ri === 0;
      let col = 0;
      const cells = row.map(cell => {
        const c = typeof cell === 'object' && cell !== null && !Array.isArray(cell) ? cell : { t: cell };
        const span = c.span || 1;
        const w = widths.slice(col, col + span).reduce((a, b) => a + b, 0);
        col += span;
        let tcPr = '<w:tcW w:w="' + w + '" w:type="dxa"/>' + (span > 1 ? '<w:gridSpan w:val="' + span + '"/>' : '');
        const shade = c.shade || (isHead ? o.headShade || '1F4E46' : null);
        if (shade) tcPr += '<w:shd w:val="clear" w:color="auto" w:fill="' + shade + '"/>';
        tcPr += '<w:vAlign w:val="center"/>';
        const ro = { b: c.b || isHead, color: c.color || (isHead ? 'FFFFFF' : undefined), size: c.size || o.size || 10 };
        const content = c.c !== undefined ? c.c : (c.rich ? rich(c.t, ro) : R(c.t, ro));
        return '<w:tc><w:tcPr>' + tcPr + '</w:tcPr>' + P(content, { align: c.align || (isHead ? 'center' : undefined), before: 30, after: 30 }) + '</w:tc>';
      }).join('');
      return '<w:tr>' + (isHead ? '<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>') + cells + '</w:tr>';
    }).join('');
    return '<w:tbl><w:tblPr><w:tblW w:w="' + total + '" w:type="dxa"/>' + borders + '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>' + grid + body + '</w:tbl>' + P('', { after: 60 });
  }
  /* 圖片段落（cx、cy 為 EMU；1 cm = 360000 EMU） */
  function imageRun(rid, idx, cx, cy, name) {
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + idx + '" name="' + x(name) + '"/>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="' + idx + '" name="' + x(name) + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }
  const field = (instr, o) => '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ' + instr + ' </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' + R('1', o) + '<w:r><w:fldChar w:fldCharType="end"/></w:r>';

  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' + W_NS + '>' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="標楷體" w:cs="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US" w:eastAsia="zh-TW"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="1F4E46"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="1F4E46"/></w:pBdr><w:spacing w:before="300" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="1F4E46"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="256C58"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr><w:rPr><w:color w:val="5F6F6A"/><w:sz w:val="19"/></w:rPr></w:style>' +
    '</w:styles>';

  function build(o) {
    const imgs = o.images || [];
    const rels = ['<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
      '<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>',
      '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
      '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>']
      .concat(imgs.map((im, i) => '<Relationship Id="rIdImg' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image' + (i + 1) + '.png"/>'));
    const sect = '<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="' + PAGE_W + '" w:h="' + PAGE_H + '"/><w:pgMar w:top="' + MARGIN + '" w:right="' + MARGIN + '" w:bottom="' + MARGIN + '" w:left="' + MARGIN + '" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>';
    const f = {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
        '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
      'docProps/core.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + x(o.title || '') + '</dc:title><dc:creator>' + x(o.creator || '') + '</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</dcterms:created></cp:coreProperties>',
      'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>',
      'word/styles.xml': STYLES,
      'word/settings.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ' + W_NS + '><w:updateFields w:val="true"/><w:defaultTabStop w:val="480"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>',
      'word/header1.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + W_NS + '>' + P(R(o.header || '', { size: 9, color: '5F6F6A' }), { align: 'right' }) + '</w:hdr>',
      'word/footer1.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + W_NS + '>' + P(R((o.footer || '') + '　第 ', { size: 9, color: '5F6F6A' }) + field('PAGE', { size: 9, color: '5F6F6A' }) + R(' 頁／共 ', { size: 9, color: '5F6F6A' }) + field('NUMPAGES', { size: 9, color: '5F6F6A' }) + R(' 頁', { size: 9, color: '5F6F6A' }), { align: 'center' }) + '</w:ftr>',
      'word/document.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + W_NS + '><w:body>' + o.body.join('') + sect + '</w:body></w:document>'
    };
    imgs.forEach((im, i) => { f['word/media/image' + (i + 1) + '.png'] = im.png; });
    return zip(f);
  }

  g.MiniDocx = { build, P, R, rich, table, imageRun, CONTENT_W };
})(typeof window === 'undefined' ? globalThis : window);
