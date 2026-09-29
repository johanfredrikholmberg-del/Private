#!/usr/bin/env python3
"""Extract only unambiguous 1:1 approved GU course decisions from GU XLS case exports."""
import glob, json, re, sys
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
INPUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'import-input'
OUT=ROOT/'data/gu/history/specific-1to1-2024-2025.json'
REPORT=ROOT/'data/gu/history/import-2024-2025-report.json'
TARGET=re.compile(r'\b([A-ZÅÄÖ][A-ZÅÄÖ0-9]{3,9}(?:-\d{3,4})?)\s*:\s*(\d+(?:[.,]\d+)?)\s*hp\b',re.I)
COURSE=re.compile(r'(.+?),\s*(\d+(?:[.,]\d+)?)\s*(?:hp|(?:ECTS )?credits)\s*,\s*(.+)',re.I|re.S)
rows=[]; report={}; seen=set()
for filename in sorted(INPUT.glob('*.xls')):
    year=int(re.search(r'20\d\d',filename.name).group())
    df=pd.read_excel(filename,header=1).fillna('')
    counts={'total':0,'approved':0,'imported':0,'ambiguous_or_missing':0,'duplicate_case':0}
    for _,r in df.iterrows():
        case=str(r.get('Ärendenummer','')).strip()
        if not re.fullmatch(r'RE\d+',case):continue
        counts['total']+=1
        if str(r.get('Ärendestatus','')).strip()!='Avslutat (Bifall)':continue
        counts['approved']+=1
        summary=' '.join(str(r.get('Ärendesammanfattning','')).split())
        # The export concatenates the full case summary twice. Keep only the first copy.
        if len(summary)%2==0 and summary[:len(summary)//2]==summary[len(summary)//2:]:summary=summary[:len(summary)//2]
        chunks=re.split(r'Meriter för tillgodoräknande|Merits for crediting',summary,flags=re.I)
        legacy=False
        if len(chunks)==1 and year==2024:
            direct=re.match(r'^\s*([A-ZÅÄÖ][A-ZÅÄÖ0-9]{3,9}(?:-\d{3,4})?)\s*:\s*(\d+(?:[.,]\d+)?)\s*hp\s+(.+)$',summary,re.I)
            if direct:
                code,points,rest=direct.groups()
                if len(re.findall(r'\d+(?:[.,]\d+)?\s*hp\s*,',rest,re.I))==1:
                    chunks=[f'{code} : {points} hp',rest];legacy=True
        if len(chunks)!=2:
            counts['ambiguous_or_missing']+=1;continue
        targets=TARGET.findall(chunks[0]); sources=re.findall(r'\d+(?:[.,]\d+)?\s*(?:hp|(?:ECTS )?credits)\s*,',chunks[1],re.I)
        match=COURSE.fullmatch(chunks[1].strip())
        prefix_ok=legacy or bool(re.match(r'^\s*(?:Tillgodoräknas som|Credited as)\s+',chunks[0],re.I))
        if len(targets)!=1 or len(sources)!=1 or not match or not prefix_ok or re.search(r'avslås|declined|delvis|partially',chunks[0],re.I) or not re.search(r'\d',targets[0][0]):
            counts['ambiguous_or_missing']+=1;continue
        name,sourcehp,institution=match.groups(); name=name.strip(); institution=institution.strip()
        if legacy and not re.search(r'(?:universitet|högskola|university|college)$',institution,re.I):
            counts['ambiguous_or_missing']+=1;continue
        if not name or not institution or len(name)>250 or len(institution)>150 or re.search(r'Tillgodoräknas som|Meriter för tillgodoräknande',name+institution,re.I):
            counts['ambiguous_or_missing']+=1;continue
        code,targethp=targets[0]; date=r.get('Inkom datum ','')
        if case in seen:counts['duplicate_case']+=1;continue
        seen.add(case)
        rows.append({'id':f'GU-{year}-{case}','university':'Göteborgs universitet','decision':'approved','decisionDate':str(date.date()) if hasattr(date,'date') else str(date),'sourceName':name,'sourceHp':float(sourcehp.replace(',','.')),'sourceInstitution':institution,'targetName':code.upper(),'targetCode':code.upper(),'targetHp':float(targethp.replace(',','.')),'approvalCount':1,'sourceCase':case,'sourceYear':year})
        counts['imported']+=1
    report[str(year)]=counts
OUT.write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':'))+'\n')
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
