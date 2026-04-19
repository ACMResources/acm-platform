#!/usr/bin/env python3
"""
ACM CV Extractor
Reads an uploaded CV file (PDF, DOCX, or TXT) and outputs structured JSON
ready to be fed into generate_cv.py.

Usage:
  python extract_cv.py <input_file> <output_json> <candidate_key> <doc_ref>

Returns: writes JSON to output_json path and prints status.
"""

import sys
import json
import re
import os
from pathlib import Path
from datetime import datetime

def extract_text_pdf(path):
    try:
        import pdfplumber
        text = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text.append(t)
        return "\n".join(text)
    except Exception as e:
        # Fallback: try pypdf
        try:
            from pypdf import PdfReader
            reader = PdfReader(path)
            return "\n".join(p.extract_text() or "" for p in reader.pages)
        except:
            return ""

def extract_text_docx(path):
    try:
        from docx import Document
        doc = Document(path)
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as e:
        return ""

def extract_text_txt(path):
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except:
        return ""

def extract_text(path):
    ext = Path(path).suffix.lower()
    if ext == '.pdf':
        return extract_text_pdf(path)
    elif ext in ('.docx', '.doc'):
        return extract_text_docx(path)
    else:
        return extract_text_txt(path)

def parse_cv_text(text, candidate_key, doc_ref):
    """
    Parse raw CV text into structured JSON using regex + heuristics.
    Best-effort extraction — will never crash, just leaves fields empty.
    """
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    # ── Basic contact info ──────────────────────────────────────────
    email = ""
    phone = ""
    address = ""

    email_re = re.compile(r'[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}')
    phone_re = re.compile(r'(\+?61[\s-]?)?0[2-9][\s-]?\d{4}[\s-]?\d{4}|\d{4}[\s-]?\d{3}[\s-]?\d{3}')

    for line in lines:
        if not email:
            m = email_re.search(line)
            if m:
                email = m.group()
        if not phone:
            m = phone_re.search(line)
            if m:
                phone = re.sub(r'\s+', ' ', m.group()).strip()

    # Address: look for suburb/state patterns
    addr_re = re.compile(r'[A-Z][a-zA-Z\s]+,?\s*(WA|NSW|VIC|QLD|SA|NT|ACT|TAS)\b.*', re.IGNORECASE)
    for line in lines[:20]:
        m = addr_re.search(line)
        if m and len(m.group()) < 80:
            address = m.group().strip()
            break

    # ── Name: usually first 1-2 non-empty lines ─────────────────────
    full_name = ""
    # candidate_key is firstname_lastname — use as fallback
    key_parts = candidate_key.replace('_', ' ').title()

    # Try to find name in first few lines — skip lines that look like titles/headers
    skip_words = {'curriculum', 'vitae', 'resume', 'cv', 'profile', 'acm', 'resources'}
    for line in lines[:8]:
        words = line.split()
        if (2 <= len(words) <= 4
                and all(w[0].isupper() for w in words if w.isalpha())
                and not any(w.lower() in skip_words for w in words)
                and not email_re.search(line)
                and not phone_re.search(line)):
            full_name = line
            break
    if not full_name:
        full_name = key_parts

    # ── Positions: look for trade/role keywords near top ────────────
    role_keywords = [
        'poly weld', 'pipe fitt', 'project manager', 'project co-ord', 'estimator',
        'site manager', 'site supervisor', 'site foreman', 'leading hand',
        'operator', 'driller', 'rigger', 'scaffolder', 'boilermaker',
        'electrician', 'plumber', 'civil', 'supervisor', 'coordinator',
        'trade assistant', 'administration', 'manager', 'director',
        'carpenter', 'concreter', 'labourer', 'mechanic', 'welder',
        'hdpe', 'pipeline', 'drilling', 'mining'
    ]
    positions = []
    for line in lines[:30]:
        ll = line.lower()
        if any(kw in ll for kw in role_keywords) and len(line) < 80 and len(line) > 4:
            # Clean it up
            pos = re.sub(r'\s+', ' ', line).strip()
            if pos not in positions:
                positions.append(pos)
        if len(positions) >= 3:
            break

    # ── Employment history ──────────────────────────────────────────
    employment = []
    # Find sections that look like employment blocks
    # Pattern: Employer name, then role, then date range
    date_re = re.compile(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[\s./\-]*\d{4}', re.IGNORECASE)
    year_re = re.compile(r'\b(19|20)\d{2}\b')
    duration_re = re.compile(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December).{0,20}(19|20)\d{2}.{0,30}(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December|Present|Current|date)', re.IGNORECASE)

    i = 0
    while i < len(lines):
        line = lines[i]
        # Look for a date range on this line or the next
        if duration_re.search(line) or (year_re.search(line) and '–' in line or ' - ' in line or ' to ' in line.lower()):
            # This line likely contains dates — look backward for employer/role
            emp_block = {
                'employer': '',
                'role': '',
                'location': 'Western Australia',
                'start': '',
                'end': '',
                'duties': []
            }

            # Extract dates
            m = duration_re.search(line)
            if m:
                date_str = m.group()
                parts = re.split(r'\s*[-–—to]+\s*', date_str, flags=re.IGNORECASE)
                if len(parts) >= 2:
                    emp_block['start'] = parts[0].strip()
                    emp_block['end'] = parts[1].strip()

            # Lines before this: employer / role
            if i > 0:
                emp_block['employer'] = lines[i-1] if i > 0 else ''
            if i > 1:
                emp_block['role'] = lines[i-2] if lines[i-2] != emp_block['employer'] else ''

            # Lines after: duties (bullet points, sentences)
            duties = []
            j = i + 1
            while j < len(lines) and j < i + 12:
                dl = lines[j]
                if duration_re.search(dl):
                    break
                if (dl.startswith('•') or dl.startswith('-') or dl.startswith('–')
                        or (len(dl) > 20 and dl[0].isupper())):
                    duty = re.sub(r'^[•\-–]\s*', '', dl).strip()
                    if duty and len(duty) > 10:
                        duties.append(duty)
                j += 1

            emp_block['duties'] = duties[:8] if duties else ['Performed duties as per role requirements.']

            if emp_block['employer'] and len(emp_block['employer']) < 100:
                employment.append(emp_block)
        i += 1

    # Deduplicate employment by employer name
    seen_emp = set()
    unique_emp = []
    for e in employment:
        k = e['employer'].lower()[:30]
        if k not in seen_emp:
            seen_emp.add(k)
            unique_emp.append(e)
    employment = unique_emp[:10]  # cap at 10 roles

    # ── Certifications / Tickets ────────────────────────────────────
    cert_keywords = {
        'white card': 'Safety',
        'working at heights': 'Safety',
        'first aid': 'Safety',
        'confined space': 'Safety',
        'gas test': 'Safety',
        'waps': 'Safety',
        'schedule 26': 'Safety',
        'standard 11': 'Safety',
        's123': 'Safety',
        'g2': 'Safety',
        'ewp': 'Competency',
        'hrwl': 'Competency',
        'forklift': 'Competency',
        'skid steer': 'Plant',
        'excavator': 'Plant',
        'dozer': 'Plant',
        'grader': 'Plant',
        'roller': 'Plant',
        'crane': 'Plant',
        'voc': 'Competency',
        'butt weld': 'Competency',
        'electrofusion': 'Competency',
        'poly weld': 'Competency',
        'pmbweld': 'Competency',
        'hdpe': 'Competency',
        'hdd': 'Drilling',
        'directional drill': 'Drilling',
        'driver licen': 'Licence',
        'mr licen': 'Licence',
        'hr licen': 'Licence',
        'mc licen': 'Licence',
        'cert iii': 'Qualification',
        'cert iv': 'Qualification',
        'certificate iii': 'Qualification',
        'certificate iv': 'Qualification',
        'diploma': 'Qualification',
        'trade certificate': 'Qualification',
        'apprenticeship': 'Qualification',
    }

    certifications = []
    seen_certs = set()
    for line in lines:
        ll = line.lower()
        for kw, cat in cert_keywords.items():
            if kw in ll and len(line) < 120:
                norm = re.sub(r'\s+', ' ', line).strip()
                slug = norm.lower()[:40]
                if slug not in seen_certs:
                    seen_certs.add(slug)
                    certifications.append({
                        'ticket': norm,
                        'category': cat,
                        'details': norm
                    })
                break

    # ── Skills ─────────────────────────────────────────────────────
    skills = []
    skill_section = False
    skill_lines = []
    for line in lines:
        ll = line.lower()
        if any(kw in ll for kw in ['key skills', 'skills', 'competencies', 'expertise', 'capabilities']):
            skill_section = True
            continue
        if skill_section:
            if any(kw in ll for kw in ['employment', 'experience', 'education', 'qualifications', 'references']):
                skill_section = False
                continue
            if line and len(line) < 100:
                skill_lines.append(line)
        if len(skill_lines) >= 10:
            break

    for sl in skill_lines[:8]:
        clean = re.sub(r'^[•\-–]\s*', '', sl).strip()
        if clean and len(clean) > 4:
            skills.append({'area': 'Skill', 'detail': clean})

    # ── Objective ──────────────────────────────────────────────────
    objective = ""
    obj_section = False
    obj_lines = []
    for line in lines:
        ll = line.lower()
        if any(kw in ll for kw in ['objective', 'summary', 'profile', 'about me', 'career objective', 'professional summary']):
            obj_section = True
            continue
        if obj_section and line:
            if any(kw in ll for kw in ['employment', 'experience', 'education', 'skills', 'qualifications', 'certif']):
                break
            obj_lines.append(line)
            if len(obj_lines) >= 4:
                break

    if obj_lines:
        objective = ' '.join(obj_lines)
    else:
        # Build from positions and name
        trade = positions[0] if positions else 'trade specialist'
        objective = f"{full_name} is an experienced {trade} with a background in mining and civil construction. Available for immediate placement through ACM Resources (Australia) Pty Ltd."

    # ── Assemble final JSON ─────────────────────────────────────────
    result = {
        "_meta": {
            "doc_ref": doc_ref,
            "date": datetime.now().strftime("%B %Y"),
            "classification": "ACM INTERNAL — PERSONNEL FILE",
            "submitted_by": "ACM Resources (Australia) Pty Ltd",
            "contact": "jobs@acmresources.com.au"
        },
        "candidate": {
            "full_name": full_name,
            "address": address,
            "phone": phone,
            "email": email,
            "visa": "Australian Citizen",
            "availability": "Full Time",
            "positions": positions if positions else [key_parts],
            "objective": objective
        },
        "employment": employment if employment else [
            {
                "employer": "Previous Employment",
                "role": positions[0] if positions else "Trade Specialist",
                "location": "Western Australia",
                "start": "2020",
                "end": "Present",
                "duties": ["Performed duties as per role requirements.", "Maintained compliance with site safety standards."]
            }
        ],
        "skills": skills if skills else [
            {"area": "Trade Skills", "detail": f"Experienced {positions[0] if positions else 'trade specialist'} with mining and civil construction background."}
        ],
        "certifications": certifications,
        "referees": "Professional references available upon request. Please contact ACM Resources to facilitate introduction."
    }

    return result


def main():
    if len(sys.argv) < 5:
        print(json.dumps({"error": "Usage: extract_cv.py <input_file> <output_json> <candidate_key> <doc_ref>"}))
        sys.exit(1)

    input_file = sys.argv[1]
    output_json = sys.argv[2]
    candidate_key = sys.argv[3]
    doc_ref = sys.argv[4]

    if not os.path.exists(input_file):
        print(json.dumps({"error": f"File not found: {input_file}"}))
        sys.exit(1)

    # Extract text
    text = extract_text(input_file)
    if not text.strip():
        print(json.dumps({"error": "Could not extract text from file. Please ensure the CV is not a scanned image-only PDF."}))
        sys.exit(1)

    # Parse into structured JSON
    data = parse_cv_text(text, candidate_key, doc_ref)

    # Write output
    Path(output_json).parent.mkdir(parents=True, exist_ok=True)
    with open(output_json, 'w') as f:
        json.dump(data, f, indent=2)

    print(json.dumps({
        "success": True,
        "full_name": data["candidate"]["full_name"],
        "employment_count": len(data["employment"]),
        "cert_count": len(data["certifications"]),
        "output": output_json
    }))

if __name__ == "__main__":
    main()
