/* HIS seed: 全部為虛構資料。以固定亂數種子產生，時間相對「今天」，使資料永遠合理。 */
(function (G) {
'use strict';
const HIS = G.HIS, DB = HIS.DB, ST = HIS.ST;
HIS.VERSION = 'HIS v1.0.0 原型版';
HIS.HOSPITAL = '臺灣綜合醫學中心';
HIS.WORKSTATIONS = ['OPD-101', 'OPD-102', 'OPD-201', 'ER-01', 'WARD-5A-01', 'WARD-7A-01', 'PHAR-01', 'LAB-01', 'RAD-01', 'REG-01', 'REG-02', 'MR-01', 'IT-01'];

function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ----- 靜態目錄 ----- */
const ICD = `I10|原發性高血壓|Essential (primary) hypertension
E11.9|第2型糖尿病，無併發症|Type 2 diabetes mellitus without complications
E11.65|第2型糖尿病併高血糖|Type 2 diabetes mellitus with hyperglycemia
E78.5|高血脂症|Hyperlipidemia, unspecified
I25.10|冠狀動脈粥樣硬化性心臟病|Atherosclerotic heart disease of native coronary artery without angina pectoris
I50.9|心臟衰竭|Heart failure, unspecified
I48.91|心房顫動|Unspecified atrial fibrillation
I21.9|急性心肌梗塞|Acute myocardial infarction, unspecified
I63.9|腦梗塞（中風）|Cerebral infarction, unspecified
J44.9|慢性阻塞性肺病|Chronic obstructive pulmonary disease, unspecified
J44.1|慢性阻塞性肺病急性惡化|COPD with (acute) exacerbation
J45.909|氣喘|Unspecified asthma, uncomplicated
J06.9|急性上呼吸道感染|Acute upper respiratory infection, unspecified
J03.90|急性扁桃腺炎|Acute tonsillitis, unspecified
J20.9|急性支氣管炎|Acute bronchitis, unspecified
J18.9|肺炎|Pneumonia, unspecified organism
A41.9|敗血症|Sepsis, unspecified organism
A09|感染性腸胃炎|Infectious gastroenteritis and colitis, unspecified
B34.9|病毒感染|Viral infection, unspecified
K21.9|胃食道逆流|Gastro-esophageal reflux disease without esophagitis
K29.70|胃炎|Gastritis, unspecified, without bleeding
K92.2|腸胃道出血|Gastrointestinal hemorrhage, unspecified
K35.80|急性闌尾炎|Unspecified acute appendicitis
K80.20|膽結石|Calculus of gallbladder without cholecystitis
K81.0|急性膽囊炎|Acute cholecystitis
K40.90|腹股溝疝氣|Unilateral inguinal hernia, without obstruction or gangrene
K59.00|便秘|Constipation, unspecified
L02.91|皮膚膿瘍|Cutaneous abscess, unspecified
L20.9|異位性皮膚炎|Atopic dermatitis, unspecified
H66.90|中耳炎|Otitis media, unspecified
H10.9|結膜炎|Unspecified conjunctivitis
N39.0|泌尿道感染|Urinary tract infection, site not specified
N10|急性腎盂腎炎|Acute pyelonephritis
N18.30|慢性腎臟病第3期|Chronic kidney disease, stage 3 unspecified
N92.0|月經過多|Excessive and frequent menstruation with regular cycle
N76.0|急性陰道炎|Acute vaginitis
D25.9|子宮肌瘤|Leiomyoma of uterus, unspecified
D64.9|貧血|Anemia, unspecified
E03.9|甲狀腺功能低下|Hypothyroidism, unspecified
E87.6|低血鉀|Hypokalemia
M54.50|下背痛|Low back pain, unspecified
M17.9|膝關節退化性關節炎|Osteoarthritis of knee, unspecified
M75.10|旋轉肌袖症候群|Rotator cuff syndrome, unspecified shoulder
M10.9|痛風|Gout, unspecified
S72.001A|股骨頸骨折（初次，閉鎖性）|Fracture of unspecified part of neck of right femur, initial encounter for closed fracture
S93.401A|踝關節扭傷|Sprain of unspecified ligament of right ankle, initial encounter
S06.0X0A|腦震盪|Concussion without loss of consciousness, initial encounter
O80|自然生產|Encounter for full-term uncomplicated delivery
Z34.90|正常懷孕產檢|Encounter for supervision of normal pregnancy, unspecified
R07.9|胸痛|Chest pain, unspecified
R10.9|腹痛|Unspecified abdominal pain
R50.9|發燒|Fever, unspecified
R51.9|頭痛|Headache, unspecified
R42|頭暈|Dizziness and giddiness
R55|暈厥|Syncope and collapse
G43.909|偏頭痛|Migraine, unspecified, not intractable, without status migrainosus
F41.9|焦慮症|Anxiety disorder, unspecified
G47.00|失眠|Insomnia, unspecified`.split('\n').map(l => { const [code, zh, en] = l.split('|'); return { code, zh, en, imported: false }; });

// zh|ingredient|spec|form|route|unit|class|allergy_class
const MEDS = `脈優|Amlodipine|5mg|錠劑|PO|錠|降血壓(CCB)
脈優|Amlodipine|10mg|錠劑|PO|錠|降血壓(CCB)
可悅您|Losartan|50mg|錠劑|PO|錠|降血壓(ARB)
得安穩|Valsartan|80mg|錠劑|PO|錠|降血壓(ARB)
得安穩|Valsartan|160mg|錠劑|PO|錠|降血壓(ARB)
康肯|Bisoprolol|2.5mg|錠劑|PO|錠|β阻斷劑
康肯|Bisoprolol|5mg|錠劑|PO|錠|β阻斷劑
天諾敏|Atenolol|50mg|錠劑|PO|錠|β阻斷劑
卡維地洛|Carvedilol|6.25mg|錠劑|PO|錠|β阻斷劑
氫氯噻嗪|Hydrochlorothiazide|25mg|錠劑|PO|錠|利尿劑|sulfa
利尿劑Lasix|Furosemide|40mg|錠劑|PO|錠|利尿劑|sulfa
利尿劑Lasix|Furosemide|20mg/2mL|注射劑|IV|支|利尿劑|sulfa
安體舒通|Spironolactone|25mg|錠劑|PO|錠|利尿劑
恩納普|Enalapril|5mg|錠劑|PO|錠|降血壓(ACEI)
冠達悅|Nifedipine SR|30mg|長效錠|PO|錠|降血壓(CCB)
異山梨醇|Isosorbide mononitrate|20mg|錠劑|PO|錠|硝酸鹽
硝化甘油|Nitroglycerin|0.6mg|舌下錠|PO|錠|硝酸鹽
阿斯匹靈|Aspirin|100mg|腸溶錠|PO|錠|抗血小板|nsaid
保栓通|Clopidogrel|75mg|錠劑|PO|錠|抗血小板
可化凝|Warfarin|5mg|錠劑|PO|錠|抗凝血劑|
拜瑞妥|Rivaroxaban|20mg|錠劑|PO|錠|抗凝血劑
立普妥|Atorvastatin|20mg|錠劑|PO|錠|降血脂
立普妥|Atorvastatin|40mg|錠劑|PO|錠|降血脂
冠脂妥|Rosuvastatin|10mg|錠劑|PO|錠|降血脂
素果|Simvastatin|20mg|錠劑|PO|錠|降血脂
芬諾貝特|Fenofibrate|200mg|膠囊|PO|顆|降血脂
毛地黃|Digoxin|0.25mg|錠劑|PO|錠|強心劑
臟得樂|Amiodarone|200mg|錠劑|PO|錠|抗心律不整
庫魯化|Metformin|500mg|錠劑|PO|錠|降血糖
庫魯化|Metformin|850mg|錠劑|PO|錠|降血糖
基利克|Glimepiride|2mg|錠劑|PO|錠|降血糖|sulfa
岱蜜克龍|Gliclazide MR|30mg|長效錠|PO|錠|降血糖|sulfa
佳糖維|Sitagliptin|100mg|錠劑|PO|錠|降血糖
恩排糖|Empagliflozin|10mg|錠劑|PO|錠|降血糖
蘭德仕|Insulin glargine|100U/mL 3mL|注射筆|SC|支|胰島素
諾和銳|Insulin aspart|100U/mL 3mL|注射筆|SC|支|胰島素
歐美拉唑|Omeprazole|20mg|膠囊|PO|顆|制酸劑(PPI)
耐適恩|Esomeprazole|40mg|錠劑|PO|錠|制酸劑(PPI)
法莫替丁|Famotidine|20mg|錠劑|PO|錠|制酸劑(H2)
莫立適|Mosapride|5mg|錠劑|PO|錠|腸胃蠕動
胃爾康|Domperidone|10mg|錠劑|PO|錠|止吐劑
解痙錠|Hyoscine butylbromide|10mg|錠劑|PO|錠|解痙劑
氧化鎂|Magnesium oxide|250mg|錠劑|PO|錠|軟便劑
止瀉寧|Loperamide|2mg|膠囊|PO|顆|止瀉劑
止吐針|Ondansetron|4mg/2mL|注射劑|IV|支|止吐劑
胃復安|Metoclopramide|10mg|錠劑|PO|錠|止吐劑
消脹散|Simethicone|40mg|咀嚼錠|PO|錠|消脹劑
泛得林|Salbutamol|100mcg/dose|吸入劑|INH|劑|支氣管擴張劑
信必可|Budesonide/Formoterol|160/4.5mcg|吸入劑|INH|劑|吸入類固醇
易咳清|Ipratropium|0.5mg/2mL|噴霧劑|INH|支|支氣管擴張劑
沐舒坦|Ambroxol|30mg|錠劑|PO|錠|化痰劑
右美沙芬|Dextromethorphan|15mg|錠劑|PO|錠|鎮咳劑
欣流|Montelukast|10mg|錠劑|PO|錠|氣喘控制
仙特明|Cetirizine|10mg|錠劑|PO|錠|抗組織胺
克敏能|Loratadine|10mg|錠劑|PO|錠|抗組織胺
潑尼松龍|Prednisolone|5mg|錠劑|PO|錠|類固醇
甲基培尼皮質醇|Methylprednisolone|40mg|注射劑|IV|支|類固醇
地塞米松|Dexamethasone|5mg/mL|注射劑|IV|支|類固醇
乙醯半胱胺酸|Acetylcysteine|600mg|發泡錠|PO|錠|化痰劑
伯樂止痛|Acetaminophen|500mg|錠劑|PO|錠|解熱鎮痛
布洛芬|Ibuprofen|400mg|錠劑|PO|錠|NSAID|nsaid
安滅痛|Diclofenac|50mg|錠劑|PO|錠|NSAID|nsaid
希樂葆|Celecoxib|200mg|膠囊|PO|顆|NSAID|nsaid,sulfa
那普洛先|Naproxen|250mg|錠劑|PO|錠|NSAID|nsaid
曲嗎竇|Tramadol|50mg|膠囊|PO|顆|鴉片類止痛
嗎啡|Morphine|10mg/mL|注射劑|IV|支|鴉片類止痛
酮咯酸|Ketorolac|30mg/mL|注射劑|IM|支|NSAID|nsaid
安康平|Etoricoxib|60mg|錠劑|PO|錠|NSAID|nsaid
肌立鬆|Orphenadrine|100mg|錠劑|PO|錠|肌肉鬆弛劑
妥復寧|Eperisone|50mg|錠劑|PO|錠|肌肉鬆弛劑
鎮頑癲|Gabapentin|300mg|膠囊|PO|顆|神經痛
利瑞卡|Pregabalin|75mg|膠囊|PO|顆|神經痛
安莫西林|Amoxicillin|500mg|膠囊|PO|顆|抗生素|penicillin
安滅菌|Amoxicillin/Clavulanate|625mg|錠劑|PO|錠|抗生素|penicillin
頭孢唑啉|Cefazolin|1g|注射劑|IV|瓶|抗生素|cephalosporin
羅氏芬|Ceftriaxone|1g|注射劑|IV|瓶|抗生素|cephalosporin
頭孢呋辛|Cefuroxime|250mg|錠劑|PO|錠|抗生素|cephalosporin
日舒|Azithromycin|250mg|錠劑|PO|錠|抗生素|macrolide
可樂比妥|Levofloxacin|500mg|錠劑|PO|錠|抗生素|quinolone
肯博|Ciprofloxacin|500mg|錠劑|PO|錠|抗生素|quinolone
磺胺甲噁唑|Sulfamethoxazole/Trimethoprim|400/80mg|錠劑|PO|錠|抗生素|sulfa
滅滴靈|Metronidazole|250mg|錠劑|PO|錠|抗生素
去氧羥四環素|Doxycycline|100mg|膠囊|PO|顆|抗生素
特治菌|Piperacillin/Tazobactam|4.5g|注射劑|IV|瓶|抗生素|penicillin
萬古黴素|Vancomycin|1g|注射劑|IV|瓶|抗生素
康納挫|Fluconazole|150mg|膠囊|PO|顆|抗黴菌
阿昔洛韋|Acyclovir|400mg|錠劑|PO|錠|抗病毒
克流感|Oseltamivir|75mg|膠囊|PO|顆|抗病毒
昂特欣|Levothyroxine|50mcg|錠劑|PO|錠|甲狀腺素
贊安諾|Alprazolam|0.5mg|錠劑|PO|錠|鎮靜安眠
使蒂諾斯|Zolpidem|10mg|錠劑|PO|錠|鎮靜安眠
立普能|Escitalopram|10mg|錠劑|PO|錠|抗憂鬱
舍曲林|Sertraline|50mg|錠劑|PO|錠|抗憂鬱
葉酸|Folic acid|5mg|錠劑|PO|錠|維生素
富馬酸亞鐵|Ferrous fumarate|200mg|錠劑|PO|錠|鐵劑
維生素D3|Cholecalciferol|1000IU|錠劑|PO|錠|維生素
生理食鹽水|Normal saline 0.9%|500mL|輸液|IV|袋|輸液
乳酸林格氏液|Lactated Ringer's|500mL|輸液|IV|袋|輸液
5%葡萄糖液|Dextrose 5% in water|500mL|輸液|IV|袋|輸液
肝素|Heparin|5000U/mL|注射劑|IV|支|抗凝血劑
克賽|Enoxaparin|40mg/0.4mL|注射劑|SC|支|抗凝血劑
傳明酸|Tranexamic acid|500mg|膠囊|PO|顆|止血劑
別嘌醇|Allopurinol|100mg|錠劑|PO|錠|痛風
秋水仙素|Colchicine|0.5mg|錠劑|PO|錠|痛風
倍他米松乳膏|Betamethasone|0.05% 15g|乳膏|TOP|條|外用類固醇
褔西地酸乳膏|Fusidic acid|2% 10g|乳膏|TOP|條|外用抗生素
優碘|Povidone-iodine|10% 30mL|外用溶液|TOP|瓶|消毒劑
利多卡因|Lidocaine|2% 5mL|注射劑|IM|支|局部麻醉
氯硝西泮|Lorazepam|2mg/mL|注射劑|IV|支|鎮靜安眠
甘油球|Glycerin|1.5g|栓劑|PR|顆|軟便劑
比沙可啶|Bisacodyl|10mg|栓劑|PR|顆|軟便劑
肛門伯樂|Acetaminophen|125mg|栓劑|PR|顆|解熱鎮痛`.split('\n').map((l, i) => { const [zh, ing, spec, form, route, unit, cls, al] = l.split('|'); return { code: 'A' + String(i + 1).padStart(4, '0'), name_zh: zh, ingredient: ing, spec, form, route, unit, class: cls, allergy_class: al || '', high_alert: /Insulin|Heparin|Morphine|Warfarin|Enoxaparin|Digoxin|Amiodarone|Lorazepam/.test(ing), imported: false }; });

const AN = `WBC|WBC 白血球|10³/μL|4.0|10.0|4.0|10.0|2.0|30|1
RBC|RBC 紅血球|10⁶/μL|4.5|5.9|4.0|5.2|||2
HB|Hb 血紅素|g/dL|13.5|17.5|12.0|16.0|7.0|20|1
HCT|Hct 血容比|%|41|53|36|46|||1
MCV|MCV|fL|80|100|80|100|||1
MCH|MCH|pg|27|33|27|33|||1
PLT|Platelet 血小板|10³/μL|150|400|150|400|20|1000|0
NEUT|Neutrophil 嗜中性球|%|40|75|40|75|||1
LYMPH|Lymphocyte 淋巴球|%|20|45|20|45|||1
MONO|Monocyte 單核球|%|2|10|2|10|||1
EOS|Eosinophil 嗜酸性球|%|0|6|0|6|||1
BASO|Basophil 嗜鹼性球|%|0|2|0|2|||1
CRP|CRP C反應蛋白|mg/dL|0|0.5|0|0.5|||2
ESR|ESR 血沉|mm/hr|0|15|0|20|||0
AST|AST(GOT)|U/L|0|40|0|35|||0
ALT|ALT(GPT)|U/L|0|41|0|33|||0
ALP|ALP|U/L|40|129|35|104|||0
TBIL|Total Bilirubin|mg/dL|0.2|1.2|0.2|1.2|||1
DBIL|Direct Bilirubin|mg/dL|0|0.3|0|0.3|||1
ALB|Albumin|g/dL|3.5|5.2|3.5|5.2|2.0||1
BUN|BUN 尿素氮|mg/dL|7|20|7|20|||0
CREA|Creatinine 肌酸酐|mg/dL|0.7|1.3|0.5|1.1||7.0|2
EGFR|eGFR|mL/min/1.73m²|90|120|90|120|15||0
URIC|Uric Acid 尿酸|mg/dL|3.5|7.2|2.6|6.0|||1
NA|Na 鈉|mmol/L|135|145|135|145|120|160|0
K|K 鉀|mmol/L|3.5|5.1|3.5|5.1|2.8|6.5|1
CL|Cl 氯|mmol/L|98|107|98|107|||0
CA|Ca 鈣|mg/dL|8.6|10.2|8.6|10.2|6.5|13|1
MG|Mg 鎂|mg/dL|1.6|2.6|1.6|2.6|||1
PHOS|Phosphorus 磷|mg/dL|2.5|4.5|2.5|4.5|||1
GLU|Glucose 血糖|mg/dL|70|99|70|99|40|500|0
HBA1C|HbA1c 糖化血色素|%|4.0|5.6|4.0|5.6|||1
TC|Total Cholesterol|mg/dL|0|200|0|200|||0
TG|Triglyceride|mg/dL|0|150|0|150|||0
HDL|HDL-C|mg/dL|40||50||||0
LDL|LDL-C|mg/dL|0|130|0|130|||0
UPH|Urine pH|-|5.0|8.0|5.0|8.0|||1
USG|Urine SG 比重|-|1.005|1.030|1.005|1.030|||3
UPRO|Urine Protein 尿蛋白|q|Negative|2+
UGLU|Urine Glucose 尿糖|q|Negative|1+
UBLD|Urine Occult Blood 尿潛血|q|Negative|1+
ULEU|Urine Leukocyte 尿白血球|q|Negative|2+
UNIT|Urine Nitrite 尿亞硝酸鹽|q|Negative|Positive
BCX|Blood Culture 血液培養|q|No growth|Gram-positive cocci in clusters
UCX|Urine Culture 尿液培養|q|No growth|E. coli >10^5 CFU/mL
PT|PT 凝血酶原時間|sec|9.5|12.5|9.5|12.5|||1
INR|INR|-|0.8|1.2|0.8|1.2||5|2
APTT|APTT|sec|25|35|25|35||100|1
TROP|Troponin I|ng/mL|0|0.04|0|0.04||0.5|3
CK|CK|U/L|39|308|26|192|||0
CKMB|CK-MB|ng/mL|0|5|0|5|||1
LDH|LDH|U/L|140|280|140|280|||0
AMY|Amylase 澱粉酶|U/L|28|100|28|100|||0
LIP|Lipase 脂肪酶|U/L|13|60|13|60|||0
TSH|TSH|μIU/mL|0.35|4.94|0.35|4.94|||2
FT4|Free T4|ng/dL|0.7|1.48|0.7|1.48|||2
BNP|BNP|pg/mL|0|100|0|100|||0
DDIM|D-dimer|μg/mL FEU|0|0.5|0|0.5|||2
FERR|Ferritin 鐵蛋白|ng/mL|30|400|13|150|||0`.split('\n').map(l => {
  const f = l.split('|'), nz = x => (x === '' || x == null ? null : parseFloat(x));
  if (f[2] === 'q') return { code: f[0], name: f[1], unit: '', type: 'q', normal: f[3], abn: f[4], lo_m: null, hi_m: null, lo_f: null, hi_f: null, crit_lo: null, crit_hi: null, dec: 0 };
  return { code: f[0], name: f[1], unit: f[2] === '-' ? '' : f[2], type: 'n', lo_m: nz(f[3]), hi_m: nz(f[4]), lo_f: nz(f[5]), hi_f: nz(f[6]), crit_lo: nz(f[7]), crit_hi: nz(f[8]), dec: parseInt(f[9] || '0') };
});
const PANELS = `CBC|全血球計數|Complete Blood Count|全血(EDTA)|WBC,RBC,HB,HCT,MCV,MCH,PLT
DIFF|白血球分類|WBC Differential|全血(EDTA)|NEUT,LYMPH,MONO,EOS,BASO
CRP|C反應蛋白|CRP|血清|CRP
ESR|紅血球沉降速率|ESR|全血(EDTA)|ESR
AST|AST(GOT)|AST|血清|AST
ALT|ALT(GPT)|ALT|血清|ALT
LFT|肝功能組|Liver Function Panel|血清|AST,ALT,ALP,TBIL,DBIL,ALB
BUN|血中尿素氮|BUN|血清|BUN
CREA|肌酸酐/eGFR|Creatinine|血清|CREA,EGFR
URIC|尿酸|Uric Acid|血清|URIC
NA|血清鈉|Sodium|血清|NA
K|血清鉀|Potassium|血清|K
ELEC|電解質組|Electrolytes|血清|NA,K,CL,CA,MG,PHOS
GLU|血糖|Glucose|血漿(NaF)|GLU
HBA1C|糖化血色素|HbA1c|全血(EDTA)|HBA1C
LIPID|血脂肪組|Lipid Profile|血清|TC,TG,HDL,LDL
UA|尿液分析|Urinalysis|尿液|UPH,USG,UPRO,UGLU,UBLD,ULEU,UNIT
BCX|血液培養|Blood Culture|血液培養瓶|BCX
UCX|尿液培養|Urine Culture|無菌尿液|UCX
PT|凝血酶原時間/INR|PT/INR|血液(Citrate)|PT,INR
APTT|活化部分凝血活酶時間|APTT|血液(Citrate)|APTT
TROP|心肌旋轉蛋白I|Troponin I|血清|TROP
CARD|心肌酵素組|Cardiac Enzymes|血清|CK,CKMB,LDH
PANC|胰臟酵素|Amylase/Lipase|血清|AMY,LIP
TFT|甲狀腺功能|TSH/FT4|血清|TSH,FT4
BNP|腦利鈉肽|BNP|全血(EDTA)|BNP
DDIM|D-dimer|D-dimer|血液(Citrate)|DDIM
FERR|鐵蛋白|Ferritin|血清|FERR`.split('\n').map(l => { const [code, zh, en, specimen, an] = l.split('|'); return { code, zh, en, specimen, analytes: an.split(',') }; });
const RADCAT = `CXR|胸部X光(PA)|Chest X-ray PA|X-ray|胸部
AXR|腹部X光|Abdomen X-ray|X-ray|腹部
XKNEE|膝關節X光|Knee X-ray|X-ray|膝
XLSP|腰椎X光|Lumbar spine X-ray|X-ray|腰椎
CTH|腦部電腦斷層(無顯影)|CT Brain without contrast|CT|頭部
CTC|胸部電腦斷層|CT Chest|CT|胸部
CTAP|腹部骨盆電腦斷層(顯影)|CT Abdomen/Pelvis with contrast|CT|腹部
MRIB|腦部核磁共振|MRI Brain|MRI|頭部
MRILS|腰椎核磁共振|MRI Lumbar spine|MRI|腰椎
USAB|腹部超音波|Ultrasound Abdomen|Ultrasound|腹部
USPV|骨盆腔超音波|Ultrasound Pelvis|Ultrasound|骨盆
USTH|甲狀腺超音波|Ultrasound Thyroid|Ultrasound|頸部
ECHO|心臟超音波|Echocardiography|Ultrasound|心臟`.split('\n').map(l => { const [code, zh, en, modality, body] = l.split('|'); return { code, zh, en, modality, body }; });
const RADTXT = {
  CXR: [['雙側肺野清晰，無明顯浸潤或積液。心臟大小正常，縱膈腔無增寬。肋膈角銳利。', '無急性心肺異常。'], ['右下肺野可見片狀浸潤影，心臟大小正常，無明顯肋膜積液。', '右下肺炎可能，建議臨床對照及追蹤。'], ['心胸比增大(CTR 0.58)，雙側肺門血管紋理增加，雙側肋膈角變鈍。', '心臟擴大合併肺水腫及少量肋膜積液，符合心衰竭表現。']],
  AXR: [['腸氣分佈正常，無異常擴張腸管，未見自由氣體，未見明顯鈣化結石陰影。', '無明顯腸阻塞或腸穿孔徵象。']],
  XKNEE: [['膝關節內側關節間隙變窄，股骨與脛骨邊緣有骨贅形成，軟骨下骨硬化。', '膝關節退化性關節炎(Kellgren-Lawrence grade 3)。']],
  XLSP: [['L4-L5、L5-S1 椎間盤高度下降，椎體邊緣骨贅，無明顯壓迫性骨折。', '下腰椎退化性變化。']],
  CTH: [['腦實質無明顯出血或佔位性病灶，腦室系統大小正常，中線無偏移。', '無急性顱內出血或大範圍梗塞。'], ['左側基底核區可見低密度病灶，無出血。', '左側基底核亞急性腦梗塞，建議 MRI 進一步評估。']],
  CTC: [['雙肺無明顯結節或實質病灶，縱膈腔無腫大淋巴結。', '胸部電腦斷層無明顯異常。']],
  CTAP: [['闌尾直徑約 11mm，壁增厚並有周圍脂肪浸潤，可見糞石。', '急性闌尾炎，無穿孔徵象。'], ['膽囊壁增厚(5mm)，膽囊內可見多顆結石，膽囊周圍積液。', '急性膽囊炎合併膽結石。']],
  MRIB: [['腦實質訊號正常，無急性梗塞，腦室大小正常。', '腦部核磁共振無明顯異常。']],
  MRILS: [['L4-5 椎間盤向後突出並壓迫硬膜囊，神經孔輕度狹窄。', 'L4-5 椎間盤突出症。']],
  USAB: [['肝臟大小正常，實質回音略增亮，膽囊內可見數顆強回音結石並伴聲影，總膽管直徑 4mm。', '輕度脂肪肝；膽結石。'], ['肝臟、膽囊、胰臟、脾臟及雙腎大小與回音正常，無腹水。', '腹部超音波無明顯異常。']],
  USPV: [['子宮肌層可見約 3.2cm 低回音肌瘤結節，雙側卵巢大小正常。', '子宮肌瘤。']],
  USTH: [['甲狀腺雙葉大小正常，右葉可見 0.6cm 低回音結節，邊界清楚。', '右葉甲狀腺小結節，TI-RADS 3。']],
  ECHO: [['左心室射出分率約 35%，左心房擴大，二尖瓣中度逆流。', '左心室收縮功能降低，符合擴張性心肌病變/心衰竭。'], ['左心室射出分率約 62%，各瓣膜結構正常，無心包膜積液。', '心臟結構與功能正常。']]
};

/* ----- 病情範本 ----- */
const IM = 'DEP-IM', SG = 'DEP-SURG', PD = 'DEP-PED', OB = 'DEP-OBG', OR = 'DEP-ORTH';
const PROF = {
  HTN: { dept: IM, dx: ['I10'], chronic: '高血壓', cc: '高血壓定期追蹤，無明顯不適。', hpi: '病人有高血壓病史多年，規則服藥，近期居家血壓約 140/85 mmHg，無頭痛、胸悶、視力模糊。', pe: '神智清楚，心音規則無雜音，雙肺呼吸音清，下肢無水腫。', ass: 'Essential hypertension，血壓控制尚可。', plan: '續用降血壓藥物，低鹽飲食，居家血壓監測，4 週後回診。', drugs: [['amlodipine 5', 1, 'QD', 28], ['losartan', 1, 'QD', 28]], labs: ['CREA', 'K'], bp: [148, 88], lt: '降血壓藥' },
  DM2: { dept: IM, dx: ['E11.9', 'E78.5'], chronic: '第2型糖尿病', cc: '糖尿病回診，追蹤血糖。', hpi: '糖尿病病史，目前使用口服降血糖藥，自測飯前血糖約 130-160 mg/dL，無三多症狀，無低血糖發作。', pe: '足部無潰瘍，足背脈搏可，心肺聽診正常。', ass: 'Type 2 DM，HbA1c 偏高，血脂異常。', plan: '續用 Metformin 與 Glimepiride，加強飲食與運動衛教，3 個月後複查 HbA1c。', drugs: [['metformin 500', 1, 'BID', 28], ['glimepiride', 1, 'QD', 28], ['atorvastatin 20', 1, 'QD', 28]], labs: ['GLU', 'HBA1C', 'LIPID'], bias: { GLU: 'H', HBA1C: 'H', LDL: 'H' }, bp: [136, 82], lt: '降血糖藥' },
  CAD: { dept: IM, dx: ['I25.10', 'I10'], chronic: '冠心症', cc: '冠心症追蹤，偶有活動後胸悶。', hpi: '冠狀動脈疾病病史，曾接受心導管，目前規則服用抗血小板及降血脂藥，近一個月爬樓梯偶有胸悶，休息數分鐘緩解。', pe: '心音規則，無明顯雜音，頸靜脈無怒張，下肢無水腫。', ass: 'CAD，穩定型心絞痛，血壓偏高。', plan: '續用 Aspirin、Statin、Bisoprolol，必要時舌下硝化甘油，安排心臟超音波。', drugs: [['aspirin', 1, 'QD', 28], ['atorvastatin 20', 1, 'QD', 28], ['bisoprolol 2.5', 1, 'QD', 28]], labs: ['LIPID', 'TROP'], rad: 'ECHO', bp: [142, 84], lt: '抗血小板藥' },
  HF: { dept: IM, dx: ['I50.9', 'I10'], chronic: '心臟衰竭', cc: '心衰竭追蹤，雙腳水腫。', hpi: '心臟衰竭病史，近兩週夜間需墊高枕頭，雙下肢輕度水腫，體重上升約 2 公斤。', pe: '雙下肢凹陷性水腫(+)，雙肺底可聞及細濕囉音，頸靜脈稍怒張。', ass: 'Congestive heart failure，輕度體液過多。', plan: '調整利尿劑，限水限鹽，每日體重監測，一週後回診。', drugs: [['furosemide 40', 1, 'BID', 14], ['carvedilol', 1, 'BID', 28], ['spironolactone', 1, 'QD', 28]], labs: ['BNP', 'CREA', 'K'], bias: { BNP: 'H' }, bp: [118, 72], lt: '利尿劑' },
  COPD: { dept: IM, dx: ['J44.9'], chronic: '慢性阻塞性肺病', cc: '慢性咳嗽及喘，定期回診。', hpi: 'COPD 病史，長期吸菸(已戒)，近期咳嗽痰量稍增，爬坡易喘，無發燒。', pe: '呼吸音減弱，呼氣相延長，無明顯囉音。', ass: 'COPD，穩定期。', plan: '續用吸入劑，避免感染，疫苗接種，3 個月後肺功能追蹤。', drugs: [['budesonide', 1, 'BID', 30], ['salbutamol', 2, 'PRN', 30]], labs: ['CBC'], bp: [128, 78], lt: '吸入劑' },
  GERD: { dept: IM, dx: ['K21.9'], chronic: '胃食道逆流', cc: '上腹灼熱、胃酸逆流。', hpi: '近一個月餐後上腹灼熱及胃酸逆流，夜間明顯，無解黑便、體重下降、吞嚥困難。', pe: '腹部柔軟，上腹輕度壓痛，無反彈痛。', ass: 'GERD。', plan: '給予 PPI 及腸胃蠕動藥，避免宵夜及咖啡，4 週後回診，持續不適考慮胃鏡。', drugs: [['esomeprazole', 1, 'QD', 28], ['mosapride', 1, 'TID', 28]], labs: [], bp: [124, 76], lt: '制酸劑' },
  THY: { dept: IM, dx: ['E03.9'], chronic: '甲狀腺功能低下', cc: '甲狀腺功能低下回診，疲倦怕冷。', hpi: '甲狀腺低下病史，規律服用 Levothyroxine，近來容易疲倦、怕冷。', pe: '甲狀腺無腫大，心率偏慢，皮膚乾燥。', ass: 'Hypothyroidism。', plan: '續用 Levothyroxine，6 週後複查 TSH。', drugs: [['levothyroxine', 1, 'QD', 28]], labs: ['TFT'], bias: { TSH: 'H' }, bp: [118, 72], lt: '甲狀腺素' },
  ANEM: { dept: IM, dx: ['D64.9'], chronic: '貧血', cc: '頭暈、容易喘，臉色蒼白。', hpi: '近三個月逐漸頭暈、疲倦、活動後心悸，無解黑便或血便，月經量不詳。', pe: '結膜蒼白，心搏稍快，無肝脾腫大。', ass: 'Anemia，待查原因（疑缺鐵性）。', plan: '補充鐵劑與葉酸，追蹤 CBC 及鐵蛋白。', drugs: [['ferrous', 1, 'BID', 28], ['folic', 1, 'QD', 28]], labs: ['CBC', 'FERR'], bias: { HB: 'L', FERR: 'L', MCV: 'L' }, bp: [110, 68], lt: '鐵劑' },
  CHOL: { dept: SG, dx: ['K80.20'], chronic: '膽結石', cc: '右上腹悶痛，油膩飲食後加重。', hpi: '近一個月餐後右上腹悶痛，偶有噁心，疼痛數小時緩解，無發燒黃疸。', pe: 'Murphy sign (-)，右上腹輕壓痛，無反彈痛。', ass: 'Cholelithiasis，無急性膽囊炎徵象。', plan: '低脂飲食，必要時解痙藥，安排腹部超音波，討論選擇性膽囊切除。', drugs: [['hyoscine', 1, 'TID', 5], ['acetaminophen 500', 1, 'TID', 5]], labs: ['LFT', 'CBC'], rad: 'USAB', bp: [126, 78], lt: '' },
  HERN: { dept: SG, dx: ['K40.90'], chronic: '腹股溝疝氣', cc: '右鼠蹊部腫塊，站立時明顯。', hpi: '右鼠蹊部腫塊數月，站立或咳嗽時突出，平躺可回納，無疼痛、噁心嘔吐。', pe: '右鼠蹊部可觸及可回納腫塊，咳嗽衝擊(+)，無壓痛。', ass: 'Right inguinal hernia，可回納。', plan: '避免提重物，安排門診手術評估，如疼痛不可回納立即急診。', drugs: [['acetaminophen 500', 1, 'PRN', 5]], labs: [], bp: [130, 80], lt: '' },
  ABSC: { dept: SG, dx: ['L02.91'], chronic: '', cc: '左大腿紅腫熱痛三天。', hpi: '左大腿皮膚紅腫熱痛三天，有波動感，無發燒。', pe: '左大腿 4×3 cm 紅腫硬塊，局部發熱，有波動感。', ass: 'Cutaneous abscess。', plan: '切開引流，口服抗生素，傷口每日換藥。', drugs: [['clavulanate', 1, 'BID', 7], ['acetaminophen 500', 1, 'PRN', 3]], labs: ['CBC', 'CRP'], proc: ['傷口處理', '切開引流後換藥'], bias: { WBC: 'H', CRP: 'H' }, bp: [122, 76], lt: '' },
  URI: { dept: PD, dx: ['J06.9'], chronic: '', cc: '流鼻水、咳嗽兩天。', hpi: '兩天前開始流鼻水、喉嚨痛、輕微咳嗽，無明顯發燒，食慾稍降，活動力尚可。', pe: '咽喉輕度紅腫，扁桃腺無膿點，雙肺呼吸音清晰。', ass: 'Acute upper respiratory infection。', plan: '症狀治療，多喝水休息，若發燒>3天或喘立即回診。', drugs: [['ambroxol', 0.5, 'TID', 5], ['cetirizine', 0.5, 'QD', 5]], labs: [], bp: [100, 62], lt: '' },
  GE: { dept: PD, dx: ['A09'], chronic: '', cc: '腹瀉、嘔吐一天。', hpi: '昨日起水瀉約 5 次，嘔吐 2 次，輕微發燒，進食量減少，尿量尚可。', pe: '輕度脫水貌，腹部柔軟，腸音亢進，無反彈痛。', ass: 'Infectious gastroenteritis。', plan: '少量多餐補充電解質，症狀治療，若血便、持續高燒、尿少即回診。', drugs: [['domperidone', 0.5, 'TID', 3], ['simethicone', 0.5, 'TID', 3]], labs: ['CBC', 'CRP'], bp: [98, 60], lt: '' },
  ASTH: { dept: PD, dx: ['J45.909'], chronic: '氣喘', cc: '夜間咳嗽、喘鳴。', hpi: '氣喘病史，近一週夜間咳嗽及喘鳴，運動後加重，無發燒。', pe: '呼氣相哮鳴音(+)，無肋骨凹陷。', ass: 'Asthma，輕度控制不良。', plan: '吸入劑加 Montelukast，環境控制，兩週後回診。', drugs: [['montelukast', 1, 'QHS', 28], ['salbutamol', 2, 'PRN', 28]], labs: [], bp: [102, 64], lt: '氣喘藥' },
  OM: { dept: PD, dx: ['H66.90'], chronic: '', cc: '耳痛、發燒兩天。', hpi: '兩天來右耳痛，夜間哭鬧，伴隨發燒 38.5°C。', pe: '右側耳膜紅腫膨出，光反射消失，左耳正常。', ass: 'Acute otitis media。', plan: '口服抗生素七天，退燒止痛，兩週後追蹤耳膜。', drugs: [['amoxicillin 500', 0.5, 'TID', 7], ['acetaminophen 500', 0.5, 'PRN', 3]], labs: [], bp: [100, 62], lt: '' },
  UTI: { dept: OB, dx: ['N39.0'], chronic: '', cc: '解尿灼熱、頻尿三天。', hpi: '三天來解尿灼熱、頻尿，下腹悶痛，無發燒、腰痛。', pe: '恥骨上輕壓痛，CVA 無叩痛。', ass: 'Urinary tract infection。', plan: '尿液檢查及培養，口服抗生素，多喝水。', drugs: [['cefuroxime', 1, 'BID', 7]], labs: ['UA', 'UCX'], bias: { UPRO: 'A', UBLD: 'A', ULEU: 'A', UNIT: 'A', UCX: 'A' }, bp: [116, 72], lt: '' },
  MENO: { dept: OB, dx: ['N92.0', 'D64.9'], chronic: '', cc: '經血量多，持續超過 8 天。', hpi: '近三個月月經量大，需每小時更換衛生棉，伴頭暈疲倦。', pe: '結膜稍蒼白，下腹無壓痛。', ass: 'Menorrhagia with anemia。', plan: '止血藥、鐵劑，安排骨盆腔超音波與 CBC。', drugs: [['tranexamic', 2, 'TID', 5], ['ferrous', 1, 'BID', 28]], labs: ['CBC'], rad: 'USPV', bias: { HB: 'L' }, bp: [108, 66], lt: '' },
  VAG: { dept: OB, dx: ['N76.0'], chronic: '', cc: '陰道搔癢、白帶增加。', hpi: '一週來外陰搔癢、豆腐渣樣白帶，無腹痛。', pe: '外陰輕度紅腫，白色乾酪樣分泌物。', ass: 'Acute vaginitis（疑黴菌）。', plan: '口服抗黴菌藥，保持乾燥，必要時回診。', drugs: [['fluconazole', 1, 'QD', 1]], labs: [], bp: [112, 70], lt: '' },
  LBP: { dept: OR, dx: ['M54.50'], chronic: '下背痛', cc: '下背痛合併左腿痠麻。', hpi: '搬重物後下背痛兩週，彎腰加劇，左大腿後側痠麻，無大小便失禁。', pe: '腰椎旁肌肉壓痛，直膝抬腿試驗左側 50°陽性，下肢肌力 5/5。', ass: 'Low back pain，疑神經根刺激。', plan: '消炎止痛、肌肉鬆弛劑、復健，必要時 MRI。', drugs: [['etoricoxib', 1, 'QD', 7], ['orphenadrine', 1, 'BID', 7]], labs: [], proc: ['復健', '腰部物理治療'], rad: 'XLSP', bp: [132, 80], lt: '' },
  KOA: { dept: OR, dx: ['M17.9'], chronic: '膝關節退化', cc: '雙膝疼痛，上下樓梯困難。', hpi: '雙膝疼痛數年，近期上下樓梯加劇，晨僵不到 30 分鐘。', pe: '雙膝內側關節線壓痛，活動時有摩擦音，無明顯積液。', ass: 'Knee osteoarthritis。', plan: '止痛藥，減重，股四頭肌訓練，考慮關節腔注射。', drugs: [['celecoxib', 1, 'BID', 14], ['acetaminophen 500', 1, 'TID', 14]], labs: [], rad: 'XKNEE', bp: [136, 82], lt: '' },
  SHLD: { dept: OR, dx: ['M75.10'], chronic: '', cc: '右肩疼痛，抬手受限。', hpi: '右肩疼痛一個月，夜間痛醒，抬手過肩困難。', pe: '右肩外展 100°疼痛弧，Neer sign (+)。', ass: 'Rotator cuff syndrome。', plan: '口服消炎藥、復健。', drugs: [['naproxen', 1, 'BID', 7]], labs: [], proc: ['復健', '肩部物理治療'], bp: [128, 78], lt: '' }
};
const ER_CASES = [
  { cc: '胸痛 30 分鐘', dx: 'R07.9', tri: 2, dept: IM, labs: ['TROP', 'CBC'], rad: 'CXR', hpi: '突發胸骨後壓迫感約 30 分鐘，放射至左肩，伴冒冷汗。', ass: 'Chest pain，r/o ACS。', plan: '心電圖、心肌酵素，觀察。' },
  { cc: '腹痛、發燒一天', dx: 'R10.9', tri: 3, dept: SG, labs: ['CBC', 'CRP', 'PANC'], rad: 'CTAP', hpi: '右下腹痛 12 小時，伴噁心、發燒 38.2°C。', ass: 'Abdominal pain，r/o appendicitis。', plan: '抽血、影像，外科會診。' },
  { cc: '發燒、咳嗽三天', dx: 'J18.9', tri: 3, dept: IM, labs: ['CBC', 'CRP'], rad: 'CXR', hpi: '三天來發燒、咳黃痰，喘。', ass: 'Pneumonia。', plan: '抗生素，視情況住院。' },
  { cc: '頭暈、站不穩', dx: 'R42', tri: 4, dept: IM, labs: ['GLU', 'CBC'], hpi: '今晨起頭暈，無肢體無力，無言語不清。', ass: 'Dizziness，生命徵象穩定。', plan: '輸液，觀察後離院。' },
  { cc: '腳踝扭傷', dx: 'S93.401A', tri: 4, dept: OR, labs: [], rad: 'XKNEE', hpi: '運動時右踝內翻扭傷，腫痛，仍可負重。', ass: 'Ankle sprain。', plan: '冰敷、固定，口服止痛。' },
  { cc: '發燒、嘔吐', dx: 'A09', tri: 4, dept: PD, labs: ['CBC'], hpi: '發燒嘔吐腹瀉一天。', ass: 'Gastroenteritis。', plan: '輸液，口服藥物。' }
];
const ADMSPEC = [
  [IM, 'J18.9', '肺炎', '5A', 7], [IM, 'I50.9', '心臟衰竭急性惡化', '5A', 8], [IM, 'J44.1', 'COPD急性惡化', '5A', 6], [IM, 'N10', '急性腎盂腎炎', '5A', 6], [IM, 'I63.9', '腦梗塞', '5A', 9], [IM, 'E11.65', '糖尿病高血糖', '5A', 5], [IM, 'A41.9', '敗血症', 'ICU', 8], [IM, 'K92.2', '上消化道出血', '5A', 6],
  [SG, 'K35.80', '急性闌尾炎', '5B', 4], [SG, 'K81.0', '急性膽囊炎', '5B', 5], [SG, 'K80.20', '膽結石（腹腔鏡膽囊切除）', '5B', 4], [SG, 'K40.90', '腹股溝疝氣修補', '5B', 3],
  [PD, 'J18.9', '兒童肺炎', '6A', 5], [PD, 'A09', '急性腸胃炎合併脫水', '6A', 3], [PD, 'J45.909', '氣喘急性發作', '6A', 4],
  [OB, 'O80', '自然生產', '6B', 3], [OB, 'O80', '自然生產', '6B', 3], [OB, 'N10', '急性腎盂腎炎', '6B', 5],
  [OR, 'S72.001A', '股骨頸骨折', '7A', 10], [OR, 'M17.9', '全膝關節置換術', '7A', 7]
];

/* ---------- 種子產生器 ---------- */
HIS.seed = function () {
  DB.reset();
  DB.bulk(() => {
    const R = rng(20260817), pick = a => a[Math.floor(R() * a.length)], ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const T = (d, h = 9, m = 0) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, m, 0, 0); return HIS.fmt(x); };
    const Dd = d => T(d).slice(0, 10);
    const add = (ts, mins) => HIS.fmt(new Date(new Date(ts.replace(' ', 'T')).getTime() + mins * 60000));
    const ins = (t, r) => DB.insert(t, r);

    /* 角色 */
    const doc = ['patient', 'opd', 'emr', 'cpoe', 'sign', 'er', 'ipd', 'consult', 'lab_view', 'rad_view', 'vitals'];
    [['R-attending', '主治醫師', doc], ['R-resident', '住院醫師', doc], ['R-nurse', '護理師', ['patient', 'vitals', 'nurse_exec', 'ipd_view', 'er', 'ward', 'bed', 'lab_view', 'rad_view']],
      ['R-pharm', '藥師', ['patient', 'pharm', 'lab_view']], ['R-lab', '檢驗師', ['patient', 'lab', 'lab_view']], ['R-radtech', '放射師', ['patient', 'rad_exec', 'rad_view']],
      ['R-radiologist', '放射科醫師', ['patient', 'rad_report', 'rad_view']], ['R-reg', '掛號人員', ['patient', 'reg', 'adt', 'bed']], ['R-mr', '病歷管理人員', ['patient', 'records', 'lab_view', 'rad_view']], ['R-admin', '系統管理員', ['*']]
    ].forEach(([id, name, perms]) => ins('roles', { id, name, perms }));
    [['DEP-IM', '內科', '臨床'], ['DEP-SURG', '外科', '臨床'], ['DEP-PED', '兒科', '臨床'], ['DEP-OBG', '婦產科', '臨床'], ['DEP-ORTH', '骨科', '臨床'], ['DEP-ER', '急診醫學科', '臨床'],
      ['DEP-PHARM', '藥劑科', '支援'], ['DEP-LAB', '檢驗醫學科', '支援'], ['DEP-RAD', '放射線科', '支援'], ['DEP-NUR', '護理部', '支援'], ['DEP-MR', '病歷室', '行政'], ['DEP-REG', '批價掛號組', '行政'], ['DEP-IT', '資訊室', '行政']
    ].forEach(([id, name, kind]) => ins('departments', { id, name, kind }));
    const U = (emp, name, role, dept, title, extra) => ins('users', Object.assign({ id: 'U-' + emp, emp_no: emp, name, role_id: role, dept_id: dept, title, pw: HIS.hash('1234'), active: true }, extra || {}));
    U('D001', '陳志明', 'R-attending', IM, '內科主治醫師', { spec: '心臟內科' }); U('D002', '林雅婷', 'R-resident', IM, '內科住院醫師');
    U('D003', '黃建國', 'R-attending', SG, '外科主治醫師', { spec: '一般外科' }); U('D004', '張家豪', 'R-resident', SG, '外科住院醫師');
    U('D005', '李美玲', 'R-attending', PD, '兒科主治醫師', { spec: '小兒科' }); U('D006', '王俊傑', 'R-resident', PD, '兒科住院醫師');
    U('D007', '吳淑芬', 'R-attending', OB, '婦產科主治醫師', { spec: '婦產科' }); U('D008', '劉冠宇', 'R-resident', OB, '婦產科住院醫師');
    U('D009', '蔡宗翰', 'R-attending', OR, '骨科主治醫師', { spec: '骨科' }); U('D010', '楊怡君', 'R-resident', OR, '骨科住院醫師');
    U('D011', '許文彥', 'R-attending', 'DEP-ER', '急診主治醫師', { spec: '急診醫學' }); U('D012', '鄭雅雯', 'R-radiologist', 'DEP-RAD', '放射科主治醫師', { spec: '診斷放射' });
    U('N001', '林佩珊', 'R-nurse', 'DEP-NUR', '病房護理師（5A）'); U('N002', '謝宜庭', 'R-nurse', 'DEP-NUR', '急診護理師'); U('N003', '郭雅琪', 'R-nurse', 'DEP-NUR', '門診護理師');
    U('PH001', '郭怡萱', 'R-pharm', 'DEP-PHARM', '藥師'); U('PH002', '洪志偉', 'R-pharm', 'DEP-PHARM', '藥師');
    U('LAB001', '曾淑惠', 'R-lab', 'DEP-LAB', '醫事檢驗師'); U('LAB002', '邱柏翰', 'R-lab', 'DEP-LAB', '醫事檢驗師');
    U('RAD001', '廖建志', 'R-radtech', 'DEP-RAD', '醫事放射師'); U('REG001', '賴雅惠', 'R-reg', 'DEP-REG', '掛號批價人員'); U('MR001', '周美華', 'R-mr', 'DEP-MR', '病歷管理師'); U('ADM001', '葉大偉', 'R-admin', 'DEP-IT', '系統管理員');
    const attending = { [IM]: 'U-D001', [SG]: 'U-D003', [PD]: 'U-D005', [OB]: 'U-D007', [OR]: 'U-D009', 'DEP-ER': 'U-D011' };
    const resident = { [IM]: 'U-D002', [SG]: 'U-D004', [PD]: 'U-D006', [OB]: 'U-D008', [OR]: 'U-D010' };
    const docOf = d => (R() < 0.7 ? attending[d] : resident[d] || attending[d]);

    /* 病房床位 */
    const wards = [['5A', '5A 內科病房', 12, IM], ['5B', '5B 外科病房', 10, SG], ['6A', '6A 兒科病房', 8, PD], ['6B', '6B 婦產科病房', 8, OB], ['7A', '7A 骨科病房', 10, OR], ['ICU', '加護病房 ICU', 6, IM], ['ERO', '急診觀察室', 6, 'DEP-ER']];
    wards.forEach(([id, name, n, dept]) => { ins('wards', { id: 'W-' + id, code: id, name, dept_id: dept, capacity: n }); for (let i = 1; i <= n; i++) ins('beds', { id: id + '-' + String(i).padStart(2, '0'), ward_id: 'W-' + id, room: id + '-R' + Math.ceil(i / 2), status: '空床' }); });
    ['5A-12', '5B-10'].forEach(b => DB.update('beds', b, { status: '維修中' })); DB.update('beds', '6B-08', { status: '保留床' });

    /* 目錄 */
    ICD.forEach(x => ins('icd10', x)); MEDS.forEach(x => ins('medications', x));
    AN.forEach(x => ins('lab_items', x)); PANELS.forEach(x => ins('lab_panels', x)); RADCAT.forEach(x => ins('radiology_catalog', x));
    MEDS.forEach((m, i) => {
      const nl = i % 7 === 0 ? 1 : ri(2, 3);
      for (let k = 0; k < nl; k++) ins('inventory', { med_code: m.code, lot_no: 'L' + (2500 + ri(1, 900)) + String.fromCharCode(65 + k), expiry: HIS.addDays(HIS.today(), ri(100, 900)), qty: ri(300, 1800), location: '藥庫-' + String.fromCharCode(65 + (i % 6)), received_at: T(ri(30, 200)) });
    });
    ins('inventory', { med_code: MEDS[10].code, lot_no: 'L2201X', expiry: HIS.addDays(HIS.today(), -20), qty: 150, location: '藥庫-B', received_at: T(300) }); // 已過期批號示範
    const lowDrug = MEDS[35]; DB.where('inventory', i => i.med_code === lowDrug.code).forEach(i => DB.update('inventory', i.id, { qty: 6 })); // 低庫存示範
    const drug = key => MEDS.find(m => (m.ingredient + ' ' + m.spec).toLowerCase().includes(key.toLowerCase()));
    const lot1 = code => DB.where('inventory', i => i.med_code === code)[0];

    /* 病人 */
    const SUR = '陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周葉蘇莊呂江何蕭羅高潘簡朱鍾彭游詹胡施沈余趙盧梁顏柯孫魏翁戴范宋方鄧杜傅侯曹薛丁卓阮馬董温唐藍石蔣古紀姚連馮歐程湯田康姜白汪鄒尤巫黎涂龔嚴韓袁金童陸夏柳邵'.split('');
    const GM = '志明,建宏,家豪,俊傑,冠宇,宗翰,承恩,柏翰,宇軒,彥廷,正雄,文彬,國樑,明德,金龍,清木,添財,健智,偉誠,嘉豪'.split(','), GF = '淑芬,美玲,雅婷,怡君,佩珊,宜庭,雅惠,淑惠,秀英,麗華,美鳳,玉蘭,惠美,靜怡,雅雯,怡萱,欣怡,詩涵,佳穎,秋香'.split(',');
    const ages = [2, 5, 7, 10, 13, 14, 16, 24, 27, 29, 31, 34, 36, 38, 22, 26, 33, 39, 41, 44, 47, 48, 52, 53, 55, 57, 58, 60, 61, 63, 64, 66, 67, 68, 69, 71, 72, 74, 76, 78, 79, 81, 83, 85, 45, 50, 56, 62, 70, 75];
    const femaleIdx = new Set([7, 8, 9, 10, 11, 12, 13]);
    const BL = ['A', 'B', 'O', 'AB'], pts = [], city = ['台北市大安區', '新北市板橋區', '桃園市中壢區', '台中市西屯區', '台南市東區', '高雄市前鎮區', '新竹市東區', '基隆市仁愛區'];
    ages.forEach((age, i) => {
      const sex = femaleIdx.has(i) ? 'F' : (age < 16 ? (R() < 0.5 ? 'M' : 'F') : (R() < 0.5 ? 'M' : 'F'));
      const by = new Date().getFullYear() - age - (R() < 0.5 ? 0 : 1), bm = ri(1, 12), bd = ri(1, 28);
      const birth = `${by}-${String(bm).padStart(2, '0')}-${String(bd).padStart(2, '0')}`;
      const nm = pick(SUR) + (sex === 'M' ? pick(GM) : pick(GF));
      const idno = String.fromCharCode(65 + ri(0, 25)) + (sex === 'M' ? '1' : '2') + String(ri(10000000, 99999999));
      const h = age < 14 ? 80 + age * 6 : (sex === 'M' ? ri(163, 182) : ri(150, 167)), w = age < 14 ? Math.round(10 + age * 3.2) : Math.round((sex === 'M' ? 22 : 21) * Math.pow(h / 100, 2) * (0.85 + R() * 0.5));
      const p = ins('patients', { chart_no: String(10000 + i * 7 + ri(0, 6)).padStart(8, '0'), name: nm, sex, birth, id_no: idno, phone: '09' + ri(10000000, 99999999), tel: '02-' + ri(2000, 2999) + '-' + ri(1000, 9999), address: pick(city) + pick(['中正路', '民生路', '和平路', '中山路', '成功路']) + ri(1, 300) + '號',
        emergency_name: pick(SUR) + pick(sex === 'M' ? GF : GM), emergency_rel: age < 18 ? pick(['父親', '母親']) : pick(['配偶', '子女', '兄弟姊妹']), emergency_phone: '09' + ri(10000000, 99999999), blood: pick(BL) + (R() < 0.92 ? '型 Rh+' : '型 Rh-'),
        height: h, weight: w, ins_type: age >= 65 && R() < 0.3 ? '榮民' : '健保', notes: '', created_at: T(ri(400, 900)) });
      pts.push(p);
    });
    // 過敏
    const ALG = [['盤尼西林', 'penicillin', '皮疹、蕁麻疹', '中度'], ['磺胺類藥物', 'sulfa', '史蒂文生-強森症候群', '重度'], ['阿斯匹靈/NSAID', 'nsaid', '氣喘發作', '中度'], ['頭孢菌素', 'cephalosporin', '全身性皮疹', '中度'], ['海鮮（蝦蟹）', '', '蕁麻疹、嘴唇腫脹', '輕度'], ['乳膠', '', '接觸性皮膚炎', '輕度'], ['奎諾酮類抗生素', 'quinolone', '肌腱炎', '中度'], ['花生', '', '呼吸困難', '重度']];
    pts.forEach((p, i) => { if (i % 3 === 1 || i % 7 === 0) { const a = pick(ALG); ins('allergies', { patient_id: p.id, allergen: a[0], allergen_class: a[1], reaction: a[2], severity: a[3], recorded_at: p.created_at, recorded_by: 'U-D001' }); } });
    const FAMH = ['父親高血壓', '母親糖尿病', '父親中風', '母親乳癌', '兄長冠心症', '無特殊家族病史', '祖父肺癌', '母親高血壓'], SURGH = ['闌尾切除術(2005)', '剖腹產(2012)', '膽囊切除術(2015)', '白內障手術(2019)', '無', '無', '疝氣修補(2010)', '心導管支架(2018)'];

    /* 病情分派 */
    const profFor = (p) => {
      const a = HIS.ageN(p.birth);
      if (a < 15) return pick(['URI', 'GE', 'ASTH', 'OM']);
      if (p.sex === 'F' && a < 50 && R() < 0.8) return pick(['UTI', 'MENO', 'VAG']);
      if (a >= 55) return pick(['HTN', 'DM2', 'CAD', 'HF', 'COPD', 'GERD', 'THY', 'KOA', 'LBP', 'HTN', 'DM2']);
      return pick(['HTN', 'DM2', 'GERD', 'ANEM', 'CHOL', 'HERN', 'ABSC', 'LBP', 'SHLD', 'KOA', 'THY']);
    };
    pts.forEach(p => { p.prof = profFor(p); const pf = PROF[p.prof]; if (R() < 0.35 && pf.dept === IM) p.prof2 = pick(['HTN', 'DM2', 'GERD']); });
    const subj = (p, pf) => ({ cc: pf.cc, hpi: pf.hpi, pmh: pf.chronic ? `${pf.chronic}病史。` : '無特殊慢性病史。', fh: '見家族病史欄。', sh: pick(['不吸菸、不喝酒', '已戒菸，偶爾飲酒', '無菸酒檳榔', '退休，與家人同住']), ros: '無發燒畏寒，無胸痛，無噁心嘔吐，無泌尿道症狀，其餘系統回顧無異常。', pe: pf.pe, assessment: pf.ass, plan: pf.plan });
    // 慢性病史/長期用藥
    pts.forEach(p => {
      const pf = PROF[p.prof];
      if (pf.chronic) ins('medical_histories', { patient_id: p.id, kind: '慢性病', text: pf.chronic, since: String(HIS.today().slice(0, 4) - ri(2, 10)), recorded_at: p.created_at, recorded_by: 'U-D001' });
      if (pf.lt) ins('medical_histories', { patient_id: p.id, kind: '長期用藥', text: pf.lt + '（' + pf.drugs.map(d => drug(d[0]).name_zh).join('、') + '）', since: '', recorded_at: p.created_at, recorded_by: 'U-D001' });
      ins('medical_histories', { patient_id: p.id, kind: '家族史', text: pick(FAMH), since: '', recorded_at: p.created_at, recorded_by: 'U-D001' });
      ins('medical_histories', { patient_id: p.id, kind: '手術史', text: HIS.ageN(p.birth) < 15 ? '無' : pick(SURGH), since: '', recorded_at: p.created_at, recorded_by: 'U-D001' });
      ins('medical_histories', { patient_id: p.id, kind: '社會史', text: pick(['不吸菸、不喝酒', '已戒菸', '偶爾飲酒', '無菸酒檳榔']), since: '', recorded_at: p.created_at, recorded_by: 'U-D001' });
      if (p.prof2) DB.insert('medical_histories', { patient_id: p.id, kind: '慢性病', text: PROF[p.prof2].chronic, since: '', recorded_at: p.created_at, recorded_by: 'U-D001' });
    });

    /* 共用建構函式 */
    const mkRecord = (enc, type, s, signedBy, t) => {
      const r = ins('medical_records', Object.assign({ patient_id: enc.patient_id, encounter_id: enc.id, admission_id: enc.admission_id || null, type, status: signedBy ? '已簽署' : '草稿', version: 1, created_at: t, created_by: enc.doctor_id, updated_at: t, updated_by: enc.doctor_id, signed_by: signedBy || null, signed_at: signedBy ? add(t, 15) : null }, s));
      if (signedBy) ins('record_versions', Object.assign({ record_id: r.id, patient_id: enc.patient_id, version: 1, saved_at: add(t, 15), saved_by: signedBy, reason: '初次簽署', status: '已簽署' }, s));
      return r;
    };
    const mkDx = (enc, codes, t) => codes.forEach((c, i) => { const x = ICD.find(k => k.code === c); ins('diagnoses', { patient_id: enc.patient_id, encounter_id: enc.id, admission_id: enc.admission_id || null, icd_code: c, zh: x.zh, en: x.en, type: i === 0 ? '主要' : '次要', status: i === 0 ? '確診' : '慢性', scope: '', date: t.slice(0, 10), doctor_id: enc.doctor_id }); });
    const mkVitals = (enc, t, bp, ill) => ins('vital_signs', { patient_id: enc.patient_id, encounter_id: enc.id, at: t, bp_sys: bp[0] + ri(-8, 10), bp_dia: bp[1] + ri(-5, 6), hr: ri(62, 92) + (ill ? 12 : 0), rr: ri(14, 20), temp: +(36.4 + R() * 0.6 + (ill ? 1.2 : 0)).toFixed(1), spo2: ri(95, 99), weight: HIS.pt(enc.patient_id).weight, height: HIS.pt(enc.patient_id).height, pain: ill ? ri(2, 6) : 0, recorded_by: 'U-N003' });
    const orderBase = (enc, t, o) => Object.assign({ patient_id: enc.patient_id, encounter_id: enc.id, admission_id: enc.admission_id || null, ordered_by: enc.doctor_id, ordered_at: t, signed_by: enc.doctor_id, signed_at: add(t, 3), sent_at: add(t, 4), priority: '一般' }, o);
    const mkMed = (enc, t, key, dose, freq, days, inp) => {
      const m = drug(key); if (!m) return;
      if (HIS.checkAllergy(enc.patient_id, m).length) return;
      const per = HIS.FREQ[freq], total = Math.max(1, Math.ceil(dose * (freq === 'PRN' ? 3 : per) * days));
      const o = ins('medication_orders', orderBase(enc, t, { med_code: m.code, med_name: m.name_zh, ingredient: m.ingredient, spec: m.spec, form: m.form, dose, dose_unit: m.unit, route: m.route, freq, days, total_qty: total, start_time: t, stop_time: add(t, days * 1440), prn: freq === 'PRN', instruction: '', note: '', allergy_override: '', inpatient: !!inp, status: ST.DONE, completed_at: add(t, 40) }));
      const rx = ins('prescriptions', { order_id: o.id, patient_id: enc.patient_id, encounter_id: enc.id, med_code: m.code, qty: total, returned_qty: 0, status: '已發藥', priority: '一般', created_at: add(t, 4), reviewed_by: 'U-PH001', reviewed_at: add(t, 10), dispensed_by: 'U-PH001', dispensed_at: add(t, 25), handed_by: 'U-PH001', handed_at: add(t, 40) });
      const lt = lot1(m.code); ins('pharmacy_dispensing', { prescription_id: rx.id, patient_id: enc.patient_id, med_code: m.code, lot_no: lt ? lt.lot_no : '', inventory_id: lt ? lt.id : null, qty: total, type: '調劑', by: 'U-PH001', at: add(t, 25) });
      ins('pharmacy_dispensing', { prescription_id: rx.id, patient_id: enc.patient_id, med_code: m.code, lot_no: '', qty: total, type: '發藥', by: 'U-PH001', at: add(t, 40) });
    };
    const resVal = (a, p, bias) => {
      if (a.type === 'q') return bias === 'A' ? a.abn : a.normal;
      const ref = HIS.refFor(a, p); let lo = ref.lo == null ? 0 : ref.lo, hi = ref.hi == null ? lo * 2 : ref.hi; const mid = (lo + hi) / 2, sp = (hi - lo) / 2;
      let v = mid + (R() - 0.5) * sp * 1.3; if (bias === 'H') v = hi + sp * (0.2 + R() * 1.0); if (bias === 'L') v = lo - sp * (0.15 + R() * 0.4); if (v < 0.01) v = 0.01 + R() * 0.3;
      return v.toFixed(a.dec);
    };
    const mkLab = (enc, t, code, bias) => {
      const pn = PANELS.find(x => x.code === code), p = HIS.pt(enc.patient_id);
      const o = ins('lab_orders', orderBase(enc, t, { panel_code: code, panel_name: pn.zh, specimen_type: pn.specimen, note: '', status: ST.DONE, report_status: '已發布' }));
      const sp = ins('specimens', { lab_order_id: o.id, patient_id: enc.patient_id, barcode: 'S' + ri(100000000, 999999999), type: pn.specimen, collected_at: add(t, 15), received_at: add(t, 25), collected_by: 'U-N003', received_by: 'U-LAB001', status: '已接收' });
      pn.analytes.forEach(ac => { const a = AN.find(x => x.code === ac), v = resVal(a, p, (bias || {})[ac]), ref = HIS.refFor(a, p); ins('lab_results', { lab_order_id: o.id, patient_id: enc.patient_id, analyte: ac, name: a.name, value: v, unit: a.unit, ref_lo: ref.lo, ref_hi: ref.hi, ref_text: a.normal || '', flag: HIS.flagOf(a, v, ref.lo, ref.hi), entered_by: 'U-LAB001', entered_at: add(t, 80) }); });
      DB.update('lab_orders', o.id, { specimen_id: sp.id, report_completed_at: add(t, 85), completed_by: 'U-LAB001', published_at: add(t, 90), published_by: 'U-LAB001', viewed_at: add(t, 150), viewed_by: enc.doctor_id });
    };
    const radDone = [];
    const mkRad = (enc, t, code, reason, abnormal) => {
      const c = RADCAT.find(x => x.code === code), tpl = RADTXT[code] || [['無明顯異常。', '無明顯異常。']], pk = abnormal && tpl.length > 1 ? tpl[tpl.length - 1 - Math.floor(R() * (tpl.length - 1))] : tpl[0];
      const o = ins('radiology_orders', orderBase(enc, t, { exam_code: code, exam_name: c.zh, modality: c.modality, reason, status: ST.DONE, exam_status: '已發布', scheduled_at: add(t, 60), room: c.modality + '-' + ri(1, 3), started_at: add(t, 65), finished_at: add(t, 85), tech_id: 'U-RAD001', viewed_at: add(t, 400), viewed_by: enc.doctor_id }));
      ins('radiology_reports', { order_id: o.id, patient_id: enc.patient_id, findings: pk[0], impression: pk[1], radiologist_id: 'U-D012', reported_at: add(t, 200), status: '已發布', published_at: add(t, 210), signed_by: 'U-D012' }); radDone.push(o.id);
    };
    const mkProc = (enc, t, type, detail) => ins('procedures', orderBase(enc, t, { proc_type: type, detail, status: ST.DONE, executed_by: 'U-N003', executed_at: add(t, 30), result_note: '已完成' }));
    const mkVisit = (p, pk, d, h, type) => {
      const pf = PROF[pk], dept = pf.dept, dr = docOf(dept), st = T(d, h, ri(0, 50));
      const ap = ins('appointments', { patient_id: p.id, doctor_id: dr, dept_id: dept, date: st.slice(0, 10), session: h < 12 ? '上午' : '下午', queue_no: ri(1, 40), status: '已看診', created_at: add(st, -3000), created_by: 'U-REG001' });
      const enc = ins('encounters', { patient_id: p.id, type: 'OPD', dept_id: dept, doctor_id: dr, appt_id: ap.id, start_time: st, end_time: add(st, 18), status: '完成' }); DB.update('appointments', ap.id, { encounter_id: enc.id });
      mkRecord(enc, '門診SOAP', subj(p, pf), dr, st); mkDx(enc, pf.dx, st); mkVitals(enc, st, pf.bp || [120, 76], ['URI', 'GE', 'OM', 'ABSC', 'UTI'].includes(pk));
      pf.drugs.forEach(dg => mkMed(enc, add(st, 12), dg[0], dg[1], dg[2], dg[3], false));
      (pf.labs || []).forEach(l => mkLab(enc, add(st, 10), l, pf.bias)); if (pf.proc) mkProc(enc, add(st, 11), pf.proc[0], pf.proc[1]);
      return enc;
    };

    /* 門診歷史（至少 100 筆） */
    const visits = [];
    pts.forEach((p, i) => {
      const nv = i % 2 === 0 ? 3 : 2; let d = ri(10, 30);
      for (let k = 0; k < nv; k++) { const pk = k === 1 && p.prof2 ? p.prof2 : p.prof; visits.push(mkVisit(p, pk, d, pick([9, 10, 11, 14, 15]), 'OPD')); d += ri(28, 85); }
    });
    // 影像：附在門診有 rad 設定的就診
    let rc = 0; visits.forEach(v => { const pk = PROF[HIS.pt(v.patient_id).prof]; if (rc < 12 && pk.rad && PROF[HIS.pt(v.patient_id).prof].dept === v.dept_id && !DB.one('radiology_orders', r => r.encounter_id === v.id)) { mkRad(v, add(v.start_time, 14), pk.rad, '臨床追蹤：' + pk.ass, R() < 0.55); rc++; } });

    /* 住院 30 筆（14 住院中 + 16 已出院） */
    const admRows = []; const used = new Set(), curUsed = new Set();
    const eligible = (dept, p) => { const a = HIS.ageN(p.birth); if (dept === PD) return a < 15; if (dept === OB) return p.sex === 'F' && a >= 16 && a < 50; return a >= 16; };
    let cur = 0;
    for (let n = 0; n < 30; n++) {
      const sp = ADMSPEC[n % ADMSPEC.length], current = n < 14, [dept, icd, dxTxt, ward, los] = sp;
      const pool = pts.filter(p => eligible(dept, p) && (!current ? true : !curUsed.has(p.id)) && !(current ? false : false));
      const p = pool[ri(0, pool.length - 1)]; if (current) curUsed.add(p.id);
      const adm0 = current ? ri(1, Math.max(1, los - 1)) : ri(25 + n * 6, 60 + n * 8), start = T(adm0, ri(8, 20), ri(0, 59)), end = current ? null : T(adm0 - los, 11, 30);
      const ward_ = ward, free = DB.where('beds', b => b.ward_id === 'W-' + ward_ && b.status === '空床');
      let bed = null; if (current) { bed = free[0]; if (!bed) { const alt = DB.where('beds', b => b.status === '空床' && DB.get('wards', b.ward_id).dept_id === dept); bed = alt[0]; } if (!bed) continue; }
      else { bed = DB.where('beds', b => b.ward_id === 'W-' + ward_)[ri(0, 6)]; }
      const attd = attending[dept], resi = resident[dept] || attd;
      const status = current ? (n >= 12 ? '出院準備' : '住院中') : '已出院';
      const adm = ins('admissions', { patient_id: p.id, dept_id: dept, attending_id: attd, resident_id: resi, admit_dx: dxTxt + ' (' + icd + ')', reason: dxTxt + '，需住院治療', ward_pref: ward, status, requested_at: add(start, -90), requested_by: attd, bed_id: bed.id, ward_id: bed.ward_id, admit_time: start, discharge_time: end, discharge_dx: current ? null : dxTxt + ' (' + icd + ')', disposition: current ? null : pick(['出院返家', '出院返家', '出院返家並門診追蹤', '轉居家護理']) });
      const enc = ins('encounters', { patient_id: p.id, type: 'IPD', dept_id: dept, doctor_id: attd, admission_id: adm.id, start_time: start, end_time: end, status: current ? '進行中' : '完成' }); DB.update('admissions', adm.id, { encounter_id: enc.id });
      if (current) DB.update('beds', bed.id, { status: '使用中' });
      const x = ICD.find(k => k.code === icd);
      ins('diagnoses', { patient_id: p.id, encounter_id: enc.id, admission_id: adm.id, icd_code: icd, zh: x.zh, en: x.en, type: '主要', status: '確診', scope: '入院診斷', date: start.slice(0, 10), doctor_id: attd });
      if (!current) ins('diagnoses', { patient_id: p.id, encounter_id: enc.id, admission_id: adm.id, icd_code: icd, zh: x.zh, en: x.en, type: '主要', status: '確診', scope: '出院診斷', date: end.slice(0, 10), doctor_id: attd });
      const pf = PROF[p.prof];
      mkRecord(enc, '入院病歷', { cc: dxTxt, hpi: `${HIS.age(p.birth)}${p.sex === 'M' ? '男' : '女'}性，因「${dxTxt}」入院。入院前數日症狀逐漸加重，由門診/急診轉入。`, pmh: pf.chronic ? pf.chronic + '病史。' : '無特殊慢性病史。', fh: '見家族史欄。', sh: '不吸菸不喝酒。', ros: '依主訴，其餘無特殊。', pe: '意識清楚，生命徵象穩定，依主訴部位有相符之理學檢查發現。', assessment: `${dxTxt} (${icd})`, plan: '住院治療：抗生素/支持療法，監測生命徵象與抽血追蹤，評估出院時機。' }, attd, start);
      const days = current ? adm0 : los;
      for (let d = 0; d <= Math.min(days, 5); d++) {
        const t = add(start, d * 1440 + 60); const last = current && d === days;
        mkVitals(enc, t, pf.bp || [124, 76], d < 2); mkVitals(enc, add(t, 480), pf.bp || [124, 76], d < 2);
        if (d > 0) mkRecord(enc, '病程紀錄', { cc: '', hpi: `住院第 ${d + 1} 天。S：${d < 3 ? '症狀稍有改善，仍有不適' : '症狀明顯改善，食慾恢復'}。`, pmh: '', fh: '', sh: '', ros: '', pe: `O：生命徵象穩定，理學檢查${d < 3 ? '同前' : '較前進步'}。`, assessment: `A：${dxTxt}，治療反應${d < 3 ? '尚可' : '良好'}。`, plan: 'P：續現行治療，追蹤檢驗。' }, last ? null : attd, t);
      }
      const inDrug = { 'J18.9': ['ceftriaxone', 1, 'Q12H', 5], 'I50.9': ['furosemide 20', 1, 'Q12H', 4], 'J44.1': ['methylprednisolone', 1, 'Q12H', 3], 'N10': ['ceftriaxone', 1, 'QD', 5], 'I63.9': ['aspirin', 1, 'QD', 7], 'E11.65': ['insulin aspart', 1, 'TID', 4], 'A41.9': ['piperacillin', 1, 'Q8H', 7], 'K92.2': ['esomeprazole', 1, 'BID', 5], 'K35.80': ['cefazolin', 1, 'Q8H', 3], 'K81.0': ['ceftriaxone', 1, 'QD', 4], 'K80.20': ['cefazolin', 1, 'Q8H', 2], 'K40.90': ['cefazolin', 1, 'Q8H', 2], 'A09': ['normal saline', 1, 'Q8H', 2], 'J45.909': ['methylprednisolone', 1, 'Q12H', 3], 'O80': ['acetaminophen 500', 1, 'Q6H', 3], 'S72.001A': ['enoxaparin', 1, 'QD', 7], 'M17.9': ['enoxaparin', 1, 'QD', 7] }[icd] || ['normal saline', 1, 'Q8H', 3];
      mkMed(enc, add(start, 40), inDrug[0], inDrug[1], inDrug[2], inDrug[3], true);
      if (R() < 0.7) mkMed(enc, add(start, 50), 'acetaminophen 500', 1, 'PRN', 3, true);
      mkLab(enc, add(start, 20), 'CBC', ['J18.9', 'N10', 'A41.9', 'K35.80', 'K81.0'].includes(icd) ? { WBC: 'H' } : null); mkLab(enc, add(start, 20), 'CREA'); if (['J18.9', 'N10', 'A41.9', 'K35.80', 'K81.0'].includes(icd)) mkLab(enc, add(start, 21), 'CRP', { CRP: 'H' });
      if (current && n % 3 === 0) { // 住院中仍有未完成（執行中）藥囑
        const m = drug('ceftriaxone');
        if (m && !HIS.checkAllergy(p.id, m).length) {
          const mo = ins('medication_orders', orderBase(enc, T(0, 7, 30), { med_code: m.code, med_name: m.name_zh, ingredient: m.ingredient, spec: m.spec, form: m.form, dose: 1, dose_unit: m.unit, route: 'IV', freq: 'QD', days: 3, total_qty: 3, start_time: T(0, 8, 0), stop_time: T(-3, 8, 0), prn: false, instruction: '', note: '', allergy_override: '', inpatient: true, status: ST.SENT }));
          ins('prescriptions', { order_id: mo.id, patient_id: p.id, encounter_id: enc.id, med_code: m.code, qty: 3, returned_qty: 0, status: '待審核', priority: '一般', created_at: T(0, 7, 35) });
        }
      }
      if (['J18.9', 'A41.9'].includes(icd) || icd === 'I50.9') { mkRad(enc, add(start, 25), icd === 'I50.9' ? 'ECHO' : 'CXR', dxTxt + '，評估病況', true); }
      if (!current) {
        mkRecord(enc, '出院病歷', { cc: dxTxt, hpi: `住院 ${los} 天，經治療後症狀改善，病況穩定。`, pmh: pf.chronic || '', fh: '', sh: '', ros: '', pe: '出院時意識清楚，生命徵象穩定。', assessment: `出院診斷：${dxTxt} (${icd})`, plan: '出院後門診追蹤，按時服藥，如有不適立即回診。' }, attd, end);
      } else if (status === '出院準備') {
        mkRecord(enc, '出院病歷', { cc: dxTxt, hpi: '病況穩定，預計近日出院。', pmh: '', fh: '', sh: '', ros: '', pe: '', assessment: `預計出院診斷：${dxTxt}`, plan: '出院後門診追蹤。' }, null, T(0, 9, 0));
      }
      admRows.push(adm);
    }
    // 一筆會診
    const a0 = admRows[0]; ins('consultations', { patient_id: a0.patient_id, encounter_id: a0.encounter_id, from_dept: a0.dept_id, from_doctor: a0.attending_id, to_dept: OR, reason: '住院期間下肢疼痛，請骨科評估', urgency: '一般', status: '已送出', sent_at: T(0, 8, 0) });
    const a1 = admRows[1]; ins('consultations', { patient_id: a1.patient_id, encounter_id: a1.encounter_id, from_dept: a1.dept_id, from_doctor: a1.attending_id, to_dept: SG, reason: '腹脹，請外科評估是否需處置', urgency: '急件', status: '已完成', sent_at: T(2, 9, 0), reply: '腹部柔軟，無外科急症，建議持續內科治療。', replied_by: 'U-D003', replied_at: T(2, 15, 0) });

    /* 急診：10 筆已離院 + 2 筆進行中 */
    for (let k = 0; k < 10; k++) {
      const c = ER_CASES[k % ER_CASES.length], p = pick(pts.filter(x => eligible(c.dept === PD ? PD : IM, x))), st = T(ri(2, 120), ri(0, 23), ri(0, 59)), dr = 'U-D011';
      const enc = ins('encounters', { patient_id: p.id, type: 'ER', dept_id: 'DEP-ER', doctor_id: dr, start_time: st, end_time: add(st, ri(120, 400)), status: '完成', triage_level: c.tri, er_status: '離院', triage_cc: c.cc });
      mkRecord(enc, '急診病歷', { cc: c.cc, hpi: c.hpi, pmh: '', fh: '', sh: '', ros: '', pe: '依主訴進行理學檢查，無明顯危急徵象。', assessment: c.ass, plan: c.plan }, dr, st); mkDx(enc, [c.dx], st); mkVitals(enc, st, [130, 80], true);
      c.labs.forEach(l => mkLab(enc, add(st, 10), l)); if (c.rad) mkRad(enc, add(st, 12), c.rad, c.cc, R() < 0.5);
      if (c.dx === 'R42') mkProc(enc, add(st, 15), '輸液', '生理食鹽水 500 mL IV drip');
    }
    [['胸悶、冒冷汗', 2], ['發燒、咳嗽', 3]].forEach(([cc, tri], k) => {
      const p = pts.filter(x => !curUsed.has(x.id) && HIS.ageN(x.birth) > 30)[k];
      const enc = ins('encounters', { patient_id: p.id, type: 'ER', dept_id: 'DEP-ER', doctor_id: null, start_time: T(0, new Date().getHours() > 1 ? new Date().getHours() - 1 : 0, 10), end_time: null, status: '進行中', triage_level: tri, er_status: '候診', triage_cc: cc });
      ins('vital_signs', { patient_id: p.id, encounter_id: enc.id, at: enc.start_time, bp_sys: 150 + k * 10, bp_dia: 92, hr: 104, rr: 22, temp: 37 + k * 1.3, spo2: 94 - k, weight: p.weight, height: p.height, pain: 6, recorded_by: 'U-N002' });
    });

    /* 影像補足 20 筆（含上面住院/急診已產生者） */
    let guard = 0; while (radDone.length < 20 && guard++ < 60) {
      const v = pick(visits); if (radDone.length >= 20) break; const code = pick(['CXR', 'USAB', 'XKNEE', 'CTH', 'MRIB', 'USTH', 'CTC', 'MRILS']);
      if (DB.one('radiology_orders', r => r.encounter_id === v.id && r.exam_code === code)) continue; mkRad(v, add(v.start_time, 16), code, '臨床評估與追蹤', R() < 0.4);
    }

    /* 今日掛號：14 筆（未看診） */
    const todayPts = pts.filter(p => !DB.one('encounters', e => e.patient_id === p.id && e.status !== '完成') && !curUsed.has(p.id)); let q = {};
    todayPts.slice(0, 14).forEach((p, i) => {
      const pk = p.prof, dept = PROF[pk].dept, dr = attending[dept], key = dr + '上午'; q[key] = (q[key] || 0) + 1;
      ins('appointments', { patient_id: p.id, doctor_id: dr, dept_id: dept, date: HIS.today(), session: '上午', queue_no: q[key], status: i % 4 === 0 ? '候診中' : '已掛號', created_at: T(2, 10), created_by: 'U-REG001' });
    });

    /* 系統訊息 / 稽核 */
    ['U-D001', 'U-D002', 'U-PH001', 'U-LAB001'].forEach(u => ins('messages', { to_user: u, text: '歡迎使用臺灣綜合醫學中心 HIS（原型版）。本系統所有資料皆為虛構。', at: T(0, 8, 0), read: false, ref: '' }));
    ins('audit_logs', { at: HIS.now(), user_id: null, emp_no: 'SYSTEM', user_name: '系統', role: '-', ws: '-', action: 'SEED', table_name: '*', record_id: '', patient_id: '', detail: '初始化虛構資料' });
    pts.forEach(p => { delete p.prof; delete p.prof2; });
  });
  DB.where('patients', () => true).forEach(() => { });
};
HIS.ensureSeed = () => { if (!DB.hasData()) HIS.seed(); };
HIS.PROF = PROF;
})(typeof globalThis !== 'undefined' ? globalThis : window);
