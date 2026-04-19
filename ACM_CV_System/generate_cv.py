#!/usr/bin/env python3
"""
ACM Resources CV Generator
Pixel-matched to Dennis Burrows CV template.

Exact colours from the source PDF:
  Navy background:  #1C2B4A
  Gold/orange:      #F5A623
  Gold underlines:  #F5A623
  Section headings: #1C2B4A (dark navy, large)
  Candidate name:   #F5A623 (gold, internal) / #1C2B4A (dark, client)
  Body text:        #1C2B4A dark on white
  Table header bg:  #1C2B4A
  Table header txt: white
  Alt table rows:   #F2F2F2 light grey
  Employer name:    #1C2B4A plain (not bold-coloured)
  Role text:        #1C2B4A plain
  Date text:        italic #1C2B4A
  "Professional Objective" label: #F5A623 gold
  Blurb left bar:   #F5A623 gold
  Blurb bg:         #F2F2F2 light grey
  Cover footer:     #F5A623 gold bg, #1C2B4A text
  Body footer:      #F5A623 gold bg, #1C2B4A text
  Header bar:       #1C2B4A navy, thin gold underline
"""

import sys
import json
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak, NextPageTemplate
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate

# ── Exact colours from Dennis's CV ──────────────────────────────────────────
NAVY        = colors.HexColor("#1C2B4A")   # all dark backgrounds
GOLD        = colors.HexColor("#F5A623")   # gold/orange accents, footer bg
WHITE       = colors.white
LIGHT_GREY  = colors.HexColor("#F2F2F2")   # alternate table rows, blurb bg
MID_GREY    = colors.HexColor("#888888")   # subtle borders
DARK_TEXT   = colors.HexColor("#1C2B4A")   # body text = same as navy

PAGE_W, PAGE_H = A4
MARGIN_L   = 20*mm
MARGIN_R   = 20*mm
CONTENT_W  = PAGE_W - MARGIN_L - MARGIN_R

# Body page geometry (matched to Dennis layout)
HEADER_H   = 30*mm   # navy bar at top of body pages
FOOTER_H   = 14*mm   # gold bar at bottom


# ── Styles ────────────────────────────────────────────────────────────────────
def make_styles():
    return {
        # Section heading: large, dark navy, like "1. Candidate Overview"
        "section_title": ParagraphStyle("section_title",
            fontName="Helvetica-Bold", fontSize=20, textColor=DARK_TEXT,
            leading=26, spaceBefore=0, spaceAfter=2),

        # Candidate name on body page (gold on internal, navy on client)
        "cand_name_internal": ParagraphStyle("cand_name_int",
            fontName="Helvetica-Bold", fontSize=11, textColor=GOLD,
            leading=15, spaceAfter=4),
        "cand_name_client": ParagraphStyle("cand_name_cli",
            fontName="Helvetica-Bold", fontSize=11, textColor=DARK_TEXT,
            leading=15, spaceAfter=4),

        # Contact table cells
        "tbl_label": ParagraphStyle("tbl_label",
            fontName="Helvetica", fontSize=9, textColor=DARK_TEXT, leading=13),
        "tbl_value": ParagraphStyle("tbl_value",
            fontName="Helvetica", fontSize=9, textColor=DARK_TEXT, leading=13),

        # "Professional Objective" gold sub-label
        "sub_label_gold": ParagraphStyle("sub_label_gold",
            fontName="Helvetica-Bold", fontSize=10, textColor=GOLD,
            leading=14, spaceBefore=8, spaceAfter=3),

        # Objective body text
        "objective": ParagraphStyle("objective",
            fontName="Helvetica", fontSize=9.5, textColor=DARK_TEXT,
            leading=14, spaceAfter=4, alignment=TA_JUSTIFY),

        # Employer name (plain, not coloured)
        "employer": ParagraphStyle("employer",
            fontName="Helvetica-Bold", fontSize=9.5, textColor=DARK_TEXT,
            leading=13),

        # Last employer in group (gold colour = from Dennis: Stages Civil is gold)
        "employer_gold": ParagraphStyle("employer_gold",
            fontName="Helvetica-Bold", fontSize=9.5, textColor=GOLD,
            leading=13),

        # Role text plain
        "role": ParagraphStyle("role",
            fontName="Helvetica", fontSize=9.5, textColor=DARK_TEXT,
            leading=12, spaceAfter=2),

        # Date — italic
        "date": ParagraphStyle("date",
            fontName="Helvetica-Oblique", fontSize=9.5, textColor=DARK_TEXT,
            leading=13),

        # Bullet point
        "bullet": ParagraphStyle("bullet",
            fontName="Helvetica", fontSize=9.5, textColor=DARK_TEXT,
            leading=13, leftIndent=8, spaceAfter=1, alignment=TA_JUSTIFY),

        # Table header white text
        "tbl_hdr": ParagraphStyle("tbl_hdr",
            fontName="Helvetica", fontSize=9.5, textColor=WHITE, leading=13),

        # Table cell text
        "tbl_cell": ParagraphStyle("tbl_cell",
            fontName="Helvetica", fontSize=9.5, textColor=DARK_TEXT,
            leading=13, alignment=TA_JUSTIFY),

        # Body text
        "body": ParagraphStyle("body",
            fontName="Helvetica", fontSize=9.5, textColor=DARK_TEXT,
            leading=14, spaceAfter=4, alignment=TA_JUSTIFY),

        # Blurb box text
        "blurb": ParagraphStyle("blurb",
            fontName="Helvetica", fontSize=9.5, textColor=DARK_TEXT,
            leading=14, alignment=TA_JUSTIFY),

        # Cover labels (gold)
        "cover_label": ParagraphStyle("cover_label",
            fontName="Helvetica-Bold", fontSize=9, textColor=GOLD, leading=13),
        "cover_value": ParagraphStyle("cover_value",
            fontName="Helvetica", fontSize=9, textColor=WHITE, leading=13),
    }

S = make_styles()


# ── COVER PAGE (canvas) ───────────────────────────────────────────────────────
def draw_cover(c, data, is_internal):
    w, h = A4
    company = "ACM RESOURCES (AUSTRALIA) PTY LTD"

    # Full navy background
    c.setFillColor(NAVY)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # Company name top-left (white, small)
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 8.5)
    c.drawString(MARGIN_L, h - 13*mm, company)

    # Gold rule under company name
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.line(MARGIN_L, h - 16*mm, w - MARGIN_R, h - 16*mm)

    # "Curriculum Vitae" — large white, lower third
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 34)
    cv_y = 138*mm
    c.drawString(MARGIN_L, cv_y, "Curriculum Vitae")

    # Candidate name — gold (internal) or ref only (client)
    name_display = data["candidate"]["full_name"] if is_internal else f"Ref: {data['_meta']['doc_ref']}"
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(MARGIN_L, cv_y - 14*mm, name_display)

    # Details block
    labels = ["Position:", "Submitted by:", "Contact:", "Date:", "Doc Ref:"]
    positions_str = "  |  ".join(data["candidate"]["positions"])
    values = [
        positions_str,
        data["_meta"]["submitted_by"],
        data["_meta"]["contact"],
        data["_meta"]["date"],
        data["_meta"]["doc_ref"],
    ]
    label_x = MARGIN_L
    value_x = MARGIN_L + 36*mm
    y = cv_y - 27*mm
    for lbl, val in zip(labels, values):
        c.setFillColor(GOLD)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(label_x, y, lbl)
        c.setFillColor(WHITE)
        c.setFont("Helvetica", 8.5)
        c.drawString(value_x, y, val)
        y -= 6.5*mm

    # Gold footer bar
    c.setFillColor(GOLD)
    c.rect(0, 0, w, 12*mm, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(w / 2, 4.5*mm, f"CURRICULUM VITAE  —  {company}")


# ── BODY PAGE HEADER / FOOTER (canvas callback) ───────────────────────────────
def make_page_callback(data, is_internal):
    company = "ACM RESOURCES (AUSTRALIA) PTY LTD"
    doc_ref = data["_meta"]["doc_ref"]

    def draw(c, doc):
        w, h = A4

        if doc.page == 1:
            draw_cover(c, data, is_internal)
            return

        # ── Navy header bar ──────────────────────────────────────────
        c.setFillColor(NAVY)
        c.rect(0, h - HEADER_H, w, HEADER_H, fill=1, stroke=0)

        # Gold rule under header bar
        c.setStrokeColor(GOLD)
        c.setLineWidth(1.2)
        c.line(0, h - HEADER_H - 0.5, w, h - HEADER_H - 0.5)

        # Company name left in header
        c.setFillColor(WHITE)
        c.setFont("Helvetica", 8.5)
        c.drawString(MARGIN_L, h - 11*mm, company)

        # "Curriculum Vitae" + doc ref right in header
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawRightString(w - MARGIN_R, h - 9*mm, "Curriculum Vitae")
        c.setFont("Helvetica", 8.5)
        c.drawRightString(w - MARGIN_R, h - 16*mm, doc_ref)

        # ── Gold footer bar ──────────────────────────────────────────
        c.setFillColor(GOLD)
        c.rect(0, 0, w, FOOTER_H, fill=1, stroke=0)

        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 8)
        body_page = doc.page - 1  # page 1 is cover
        c.drawString(MARGIN_L, 5*mm, f"{company}  —  CURRICULUM VITAE")
        c.drawRightString(w - MARGIN_R, 5*mm, f"Page {body_page}")

    return draw


# ── SECTION HEADER ────────────────────────────────────────────────────────────
def section_header(num, title):
    return [
        Spacer(1, 8*mm),
        Paragraph(f"{num}. {title}", S["section_title"]),
        HRFlowable(width="100%", thickness=1.0, color=GOLD, spaceAfter=5),
    ]


# ── CONTACT TABLE ─────────────────────────────────────────────────────────────
def contact_table(rows):
    """Alternating light-grey / white rows, full-width."""
    tbl_data = [
        [Paragraph(r[0], S["tbl_label"]), Paragraph(r[1], S["tbl_value"])]
        for r in rows
    ]
    t = Table(tbl_data, colWidths=[35*mm, CONTENT_W - 35*mm])
    style = [
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("LINEBELOW",     (0, 0), (-1, -1), 0.4, colors.HexColor("#DDDDDD")),
        ("BOX",           (0, 0), (-1, -1), 0.4, colors.HexColor("#DDDDDD")),
    ]
    # Alternate row shading
    for i in range(len(rows)):
        if i % 2 == 1:
            style.append(("BACKGROUND", (0, i), (-1, i), LIGHT_GREY))
        else:
            style.append(("BACKGROUND", (0, i), (-1, i), WHITE))
    t.setStyle(TableStyle(style))
    return t


# ── NAVY-HEADER TABLE ─────────────────────────────────────────────────────────
def navy_table(header_row, data_rows, col_widths):
    """Table with navy header row and alternating body rows."""
    all_rows = [header_row] + data_rows
    t = Table(all_rows, colWidths=col_widths)
    style = [
        ("BACKGROUND",    (0, 0), (-1, 0),  NAVY),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  WHITE),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("LINEBELOW",     (0, 0), (-1, -1), 0.4, colors.HexColor("#DDDDDD")),
        ("BOX",           (0, 0), (-1, -1), 0.4, colors.HexColor("#DDDDDD")),
    ]
    for i in range(1, len(all_rows)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), LIGHT_GREY))
        else:
            style.append(("BACKGROUND", (0, i), (-1, i), WHITE))
    t.setStyle(TableStyle(style))
    return t


# ── BUILD BODY CONTENT ────────────────────────────────────────────────────────
def build_body(data, is_internal):
    story = []

    # Cover is drawn by canvas — add placeholder + switch to body template
    story.append(Spacer(1, 1))
    story.append(NextPageTemplate("body"))
    story.append(PageBreak())

    # ── 1. Candidate Overview ─────────────────────────────────────────
    story.append(Paragraph("1. Candidate Overview", S["section_title"]))
    story.append(HRFlowable(width="100%", thickness=1.0, color=GOLD, spaceAfter=5))

    # Candidate name
    name_style = S["cand_name_internal"] if is_internal else S["cand_name_client"]
    name_display = data["candidate"]["full_name"] if is_internal else f"Ref: {data['_meta']['doc_ref']}"
    story.append(Paragraph(name_display, name_style))

    # Contact table rows
    if is_internal:
        contact_rows = [
            ["Address",      data["candidate"].get("address", "—") or "—"],
            ["Phone",        data["candidate"].get("phone", "—") or "—"],
            ["Email",        data["candidate"].get("email", "—") or "—"],
            ["Submitted by", f"{data['_meta']['submitted_by']} | {data['_meta']['contact']}"],
        ]
    else:
        contact_rows = [
            ["Ref",          data["_meta"]["doc_ref"]],
            ["Submitted by", f"{data['_meta']['submitted_by']} | {data['_meta']['contact']}"],
        ]
    if data["candidate"].get("visa"):
        contact_rows.append(["Visa", data["candidate"]["visa"]])
    if data["candidate"].get("availability"):
        contact_rows.append(["Availability", data["candidate"]["availability"]])

    story.append(contact_table(contact_rows))

    # Professional Objective
    story.append(Paragraph("Professional Objective", S["sub_label_gold"]))
    story.append(Paragraph(data["candidate"]["objective"], S["objective"]))

    # ── 2. Employment History ─────────────────────────────────────────
    story += section_header(2, "Employment History")

    for i, job in enumerate(data["employment"]):
        loc = job.get("location", "")
        employer_line = job["employer"]
        if loc:
            employer_line = f"{job['employer']}"
        # Last employer in Dennis uses gold — we apply gold to any employer
        # that is at an odd position (matching Dennis's visual pattern)
        # Actually from Dennis: only "Stages Civil & Electrical" is gold — the last one
        # We'll apply gold to the last job entry to match exactly
        use_gold = (i == len(data["employment"]) - 1)
        emp_style = S["employer_gold"] if use_gold else S["employer"]

        date_row = Table(
            [[Paragraph(employer_line, emp_style),
              Paragraph(f"{job['start']} – {job['end']}", S["date"])]],
            colWidths=[CONTENT_W * 0.62, CONTENT_W * 0.38]
        )
        date_row.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "BOTTOM"),
            ("ALIGN",         (1, 0), (1, 0),   "RIGHT"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))

        block = [date_row, Paragraph(job["role"], S["role"])]
        for duty in job["duties"]:
            block.append(Paragraph(f"• {duty}", S["bullet"]))
        block.append(Spacer(1, 5))
        story.append(KeepTogether(block))

    # ── 3. Skills & Competencies ──────────────────────────────────────
    story += section_header(3, "Skills & Competencies")

    skill_header = [Paragraph("Competency Area", S["tbl_hdr"]),
                    Paragraph("Detail", S["tbl_hdr"])]
    skill_rows = [
        [Paragraph(s["area"], S["tbl_cell"]),
         Paragraph(s["detail"], S["tbl_cell"])]
        for s in data["skills"]
    ]
    story.append(navy_table(skill_header, skill_rows,
                            [CONTENT_W * 0.30, CONTENT_W * 0.70]))

    # ── 4. Licences & Certifications ──────────────────────────────────
    story += section_header(4, "Licences & Certifications")

    cert_header = [Paragraph("Certification / Ticket", S["tbl_hdr"]),
                   Paragraph("Category", S["tbl_hdr"]),
                   Paragraph("Details", S["tbl_hdr"])]
    cert_rows = [
        [Paragraph(c["ticket"], S["tbl_cell"]),
         Paragraph(c.get("category", ""), S["tbl_cell"]),
         Paragraph(c.get("details", ""), S["tbl_cell"])]
        for c in data["certifications"]
    ]
    story.append(navy_table(cert_header, cert_rows,
                            [CONTENT_W * 0.38, CONTENT_W * 0.20, CONTENT_W * 0.42]))

    # ── 5. Referees ───────────────────────────────────────────────────
    story += section_header(5, "Referees")
    story.append(Paragraph(data["referees"], S["body"]))
    story.append(Spacer(1, 5))

    # Blurb box with gold left border + light grey bg
    candidate_name = data["candidate"]["full_name"] if is_internal else f"this candidate (Ref: {data['_meta']['doc_ref']})"
    blurb_txt = (
        f"ACM Resources is an active labour hire and construction contractor operating across "
        f"WA mining and civil sectors. {candidate_name} is presented by ACM as a skilled professional "
        f"available for immediate placement. All enquiries regarding this CV should be directed to "
        f"{data['_meta']['contact']}."
    )
    blurb_tbl = Table([[Paragraph(blurb_txt, S["blurb"])]], colWidths=[CONTENT_W])
    blurb_tbl.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND",    (0, 0), (-1, -1), LIGHT_GREY),
        ("LINEBEFORE",    (0, 0), (0, -1),  3, GOLD),
    ]))
    story.append(blurb_tbl)
    story.append(Spacer(1, 10*mm))

    return story


# ── GENERATE PDF ──────────────────────────────────────────────────────────────
def generate_pdf(data, output_path, is_internal):
    # Body pages: content sits between header bar and footer bar
    TOP_MARGIN    = HEADER_H + 4*mm
    BOTTOM_MARGIN = FOOTER_H + 4*mm

    doc = BaseDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN_L,
        rightMargin=MARGIN_R,
        topMargin=TOP_MARGIN,
        bottomMargin=BOTTOM_MARGIN,
    )

    # Cover frame — full page, canvas does all the drawing
    cover_frame = Frame(0, 0, PAGE_W, PAGE_H,
                        leftPadding=0, rightPadding=0,
                        topPadding=0, bottomPadding=0,
                        id="cover")

    # Body frame — sits inside header/footer margins
    body_frame = Frame(
        MARGIN_L,
        BOTTOM_MARGIN,
        CONTENT_W,
        PAGE_H - TOP_MARGIN - BOTTOM_MARGIN,
        leftPadding=0, rightPadding=0,
        topPadding=0, bottomPadding=0,
        id="body"
    )

    cb = make_page_callback(data, is_internal)
    cover_tmpl = PageTemplate(id="cover", frames=[cover_frame], onPage=cb)
    body_tmpl  = PageTemplate(id="body",  frames=[body_frame],  onPage=cb)
    doc.addPageTemplates([cover_tmpl, body_tmpl])

    story = build_body(data, is_internal)
    doc.build(story)
    label = "INTERNAL" if is_internal else "CLIENT"
    print(f"  ✓ {label} → {output_path}")


# ── ENTRY POINT ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_cv.py <firstname_lastname>")
        sys.exit(1)

    key = sys.argv[1]
    base = Path(__file__).parent
    json_path = base / "candidates" / f"{key}.json"

    if not json_path.exists():
        print(f"ERROR: {json_path} not found")
        sys.exit(1)

    with open(json_path) as f:
        data = json.load(f)

    doc_ref = data["_meta"]["doc_ref"]
    client_path   = base / "output" / "client"   / f"{doc_ref}_client.pdf"
    internal_path = base / "output" / "internal" / f"{doc_ref}_internal.pdf"

    print(f"\nACM CV Generator — {data['candidate']['full_name']} [{doc_ref}]")
    generate_pdf(data, str(client_path),   is_internal=False)
    generate_pdf(data, str(internal_path), is_internal=True)
    print("\nDone.")
