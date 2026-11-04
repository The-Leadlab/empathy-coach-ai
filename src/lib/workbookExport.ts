import { jsPDF } from "jspdf";
import JSZip from "jszip";
import type { WorkbookRecord, WorkbookSectionDraft } from "./workbookAuthorApi";

function agencyList(sections: WorkbookSectionDraft[]) {
  const set = new Set<string>();
  for (const s of sections) {
    for (const src of s.sources || []) {
      if (src.agency) set.add(String(src.agency));
    }
  }
  return [...set];
}

export function exportWorkbookPdf(workbook: WorkbookRecord) {
  const sections = workbook.sections || [];
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const addPageIfNeeded = (need = 60) => {
    if (y + need > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(workbook.title || "Workbook", margin, y);
  y += 28;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Topic: ${workbook.topic}`, margin, y);
  y += 16;
  doc.text(`Method: ${workbook.method}`, margin, y);
  y += 16;
  doc.text(`Audience: ${workbook.audience}`, margin, y);
  y += 16;
  doc.setTextColor(120);
  doc.text("Draft — clinician review required", margin, y);
  doc.setTextColor(0);
  y += 28;

  for (const section of sections) {
    addPageIfNeeded(80);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(section.title, margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(section.body_md || "", width);
    for (const line of lines) {
      addPageIfNeeded(16);
      doc.text(line, margin, y);
      y += 14;
    }
    y += 16;
  }

  addPageIfNeeded(100);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Sources & credits", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const credit = `Adapted from US public-domain materials (${agencyList(sections).join(", ") || "agency list"}). Not an official product of these agencies. Draft for clinician use.`;
  for (const line of doc.splitTextToSize(credit, width)) {
    addPageIfNeeded(16);
    doc.text(line, margin, y);
    y += 14;
  }

  doc.save(`${(workbook.title || "workbook").replace(/[^\w\- ]+/g, "")}.pdf`);
}

function escapeXml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function exportWorkbookDocx(workbook: WorkbookRecord) {
  const sections = workbook.sections || [];
  const paras: string[] = [];
  const push = (text: string, bold = false) => {
    const t = escapeXml(text);
    paras.push(
      `<w:p><w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${t}</w:t></w:r></w:p>`,
    );
  };

  push(workbook.title || "Workbook", true);
  push(`Topic: ${workbook.topic}`);
  push(`Method: ${workbook.method}`);
  push(`Audience: ${workbook.audience}`);
  push("Draft — clinician review required");
  push("");

  for (const section of sections) {
    push(section.title, true);
    for (const line of String(section.body_md || "").split(/\n/)) {
      push(line || " ");
    }
    push("");
  }

  push("Sources & credits", true);
  push(
    `Adapted from US public-domain materials (${agencyList(sections).join(", ") || "agency list"}). Not an official product of these agencies. Draft for clinician use.`,
  );

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paras.join("\n")}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.folder("word")?.file("document.xml", documentXml);

  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(workbook.title || "workbook").replace(/[^\w\- ]+/g, "")}.docx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
