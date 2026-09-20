import { db } from 'hatchable';

export const access = 'public';

const esc = s => String(s ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const fmt = v => v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(Math.abs(Number(v)) >= 10 ? 0 : 1);
const pct = v => v == null || !Number.isFinite(Number(v)) ? '—' : (Number(v) > 0 ? '+' : '') + fmt(v) + '%';

const labels = {
  resting_hr:'Resting HR', hrv:'HRV', sleep:'Sleep', steps:'Steps', activity:'Activity',
  glucose:'Glucose', temperature:'Temperature', stress:'Stress', respiratory_rate:'Respiratory rate',
  calories:'Calories', heart_rate:'Heart rate', oxygen_variation:'Oxygen variation',
  vo2_max:'VO₂ max', distance:'Distance', lh:'LH', estrogen:'Estrogen', pdg:'PdG',
  flow_volume:'Flow volume', fatigue:'Fatigue', sleep_issue:'Sleep issue', cramps:'Cramps',
  headaches:'Headaches', sore_breasts:'Sore breasts', mood_swing:'Mood swing',
  appetite:'Appetite', exercise_level:'Exercise level', stress_reported:'Reported stress',
  food_cravings:'Food cravings', indigestion:'Indigestion', bloating:'Bloating'
};

const qLabels = {
  exercise:'Activity / exercise change',
  stress:'Stress / workload change',
  meds:'Medication or supplement change',
  illness:'Recent illness or infection'
};

export default async function(req,res){
  const profileKey = req.query?.profileKey || 'my-health-story';
  const origin = new URL(req.url).origin;
  const qs = '?profileKey=' + encodeURIComponent(profileKey);

  let story = {}, insights = {}, relationships = {};
  try {
    const [a,b,c] = await Promise.all([
      fetch(origin + '/api/health-story' + qs),
      fetch(origin + '/api/insights' + qs),
      fetch(origin + '/api/relationships' + qs)
    ]);
    if (a.ok) story = await a.json();
    if (b.ok) insights = await b.json();
    if (c.ok) relationships = await c.json();
  } catch {}

  const profileRows = (await db.query(
    'SELECT name, age, sex, concern FROM health_profiles WHERE profile_key = $1 LIMIT 1',
    [profileKey]
  )).rows;
  const profile = profileRows[0] || {};

  const eventMeta = (await db.query(
    `SELECT COUNT(*)::int AS events, COUNT(DISTINCT event_date)::int AS days,
            MIN(event_date) AS first_date, MAX(event_date) AS last_date,
            COUNT(DISTINCT metric)::int AS metrics
       FROM health_events
      WHERE profile_key = $1 AND value_numeric IS NOT NULL`,
    [profileKey]
  )).rows[0] || {};

  const metricCoverage = (await db.query(
    `SELECT metric, COUNT(DISTINCT event_date)::int AS days,
            MIN(event_date) AS first_date, MAX(event_date) AS last_date
       FROM health_events
      WHERE profile_key = $1 AND value_numeric IS NOT NULL
      GROUP BY metric
      ORDER BY metric`,
    [profileKey]
  )).rows;

  const labDocuments = (await db.query(
    `SELECT id, document_date, title, document_type, provider, notes, original_filename
       FROM lab_documents
      WHERE profile_key = $1
      ORDER BY document_date DESC NULLS LAST, created_at DESC`,
    [profileKey]
  )).rows;

  const answers = (await db.query(
    `SELECT question_key, answer
       FROM interview_answers
      WHERE profile_key = $1
      ORDER BY created_at DESC`,
    [profileKey]
  )).rows;
  const latestAnswers = {};
  for (const a of answers) if (latestAnswers[a.question_key] == null) latestAnswers[a.question_key] = a.answer;

  const changes = story.changes || {};
  const details = story.changeDetails || {};
  const findings = insights.findings || [];
  const findingMap = Object.fromEntries(findings.map(f => [f.metric, f]));
  const allMetricNames = Object.keys(changes).filter(k => changes[k] != null)
    .sort((a,b) => Math.abs(Number(changes[b])) - Math.abs(Number(changes[a])));

  const changeRows = allMetricNames.map(metric => {
    const d = details[metric] || {};
    const f = findingMap[metric];
    return `<tr>
      <td><b>${esc(labels[metric] || metric)}</b></td>
      <td>${fmt(d.baseline)}</td>
      <td>${fmt(d.recent)}</td>
      <td>${pct(d.changePct ?? changes[metric])}</td>
      <td>${pct(d.trend7Pct)}</td>
      <td>${f ? esc(String(f.persistentDays)) : '—'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6">No numeric changes available.</td></tr>';

  const relationshipRows = (relationships.relationships || []).slice(0,10).map(p => `<tr>
    <td><b>${esc(labels[p.a] || p.a)}</b> ↔ <b>${esc(labels[p.b] || p.b)}</b></td>
    <td>${esc(String(p.r))}</td>
    <td>${esc(p.strength || 'association')}</td>
    <td>${esc(String(p.sampleSize || '—'))}</td>
    <td>${p.lagDays ? esc(String(Math.abs(p.lagDays)) + ' day') : 'Same day'}</td>
  </tr>`).join('') || '<tr><td colspan="5">Not enough overlapping data to report relationships yet.</td></tr>';

  const contextRows = Object.entries(latestAnswers).map(([k,v]) => `<tr>
    <td><b>${esc(qLabels[k] || k)}</b></td><td>${esc(v || 'Not answered')}</td>
  </tr>`).join('') || '<tr><td colspan="2">No patient-reported context recorded.</td></tr>';

  const coverageRows = metricCoverage.map(r => {
    const d = details[r.metric] || {};
    const latest = (story.series || []).slice().reverse().find(x => x.values && x.values[r.metric] != null);
    return `<tr>
      <td><b>${esc(labels[r.metric] || r.metric)}</b></td>
      <td>${esc(String(r.days))}</td>
      <td>${esc(String(r.first_date || '—'))}</td>
      <td>${esc(String(r.last_date || '—'))}</td>
      <td>${fmt(latest?.values?.[r.metric])}</td>
      <td>${pct(d.changePct)}</td>
    </tr>`;
  }).join('');

  const labRows = labDocuments.map(d => `<tr>
    <td>${esc(String(d.document_date || 'Date not entered'))}</td>
    <td><b>${esc(d.title)}</b><br><span class="small">${esc(d.original_filename)}</span></td>
    <td>${esc(d.document_type || 'Medical record')}</td>
    <td>${esc(d.provider || '—')}</td>
    <td>${d.notes ? esc(d.notes) : '—'}</td>
    <td><a href="/api/lab-documents/${d.id}">Open</a></td>
  </tr>`).join('') || '<tr><td colspan="6">No stored medical documents yet.</td></tr>';

  const reportDate = new Date().toISOString().slice(0,10);
  const displayName = profile.name || 'My Health Story';
  const concern = profile.concern || 'Longitudinal health data review';

  return res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PulseStory — Clinician Brief</title>
<style>
@page { size:A4; margin:14mm 13mm 16mm; }
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#18202a;background:#fff;font-size:10.5px;line-height:1.45;margin:0}
h1,h2,h3,p{margin:0}
h1{font-size:24px;letter-spacing:-.4px}
h2{font-size:14px;margin-bottom:7px}
h3{font-size:11px;margin-bottom:5px}
.header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #18202a;padding-bottom:10px;margin-bottom:12px}
.kicker{font-size:8px;letter-spacing:1.6px;text-transform:uppercase;font-weight:700;margin-bottom:3px}
.meta{text-align:right;font-size:9px;color:#5c6672}
.sub{color:#56616d;margin-top:3px}
.notice{border:1px solid #cfd6dd;border-radius:7px;padding:8px 10px;margin:10px 0 13px;background:#f7f8fa}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}
.card{border:1px solid #d9dee4;border-radius:7px;padding:9px}
.big{font-size:18px;font-weight:700;margin-top:2px}
.small{font-size:8.5px;color:#65717d}
table{width:100%;border-collapse:collapse;margin:5px 0 13px;font-size:8.7px}
th{text-align:left;background:#eef1f4;font-weight:700}
th,td{border-bottom:1px solid #e0e4e8;padding:5px 5px;vertical-align:top}
section{margin-bottom:13px}
.page-break{break-before:page}
.badge{display:inline-block;border:1px solid #ccd3da;border-radius:99px;padding:2px 6px;font-size:8px;color:#4f5a66}
.footer{border-top:1px solid #dfe3e7;padding-top:7px;color:#68737e;font-size:8px;margin-top:15px}
ul{margin:5px 0 0 16px;padding:0}
li{margin:2px 0}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none}}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="kicker">PulseStory · Clinician Brief</div>
    <h1>${esc(displayName)}</h1>
    <p class="sub">${esc(concern)}</p>
  </div>
  <div class="meta">
    Prepared ${esc(reportDate)}<br>
    Data: ${esc(String(eventMeta.first_date || '—'))} → ${esc(String(eventMeta.last_date || '—'))}<br>
    ${esc(String(eventMeta.events || 0))} numeric observations · ${esc(String(eventMeta.metrics || 0))} signals
  </div>
</div>

<div class="notice">
  <b>Purpose:</b> A concise longitudinal summary for discussion with a clinician. PulseStory reports observed changes and statistical associations in the available data; it does not establish diagnosis or causation.
</div>

<div class="grid">
  <div class="card"><div class="kicker">Observed period</div><div class="big">${esc(String(eventMeta.days || 0))} days</div><div class="small">${esc(String(eventMeta.first_date || '—'))} to ${esc(String(eventMeta.last_date || '—'))}</div></div>
  <div class="card"><div class="kicker">Persistent changes</div><div class="big">${esc(String(findings.length))}</div><div class="small">Signals meeting the current persistence rule</div></div>
  <div class="card"><div class="kicker">All numeric signals</div><div class="big">${esc(String(eventMeta.metrics || 0))}</div><div class="small">Included in the longitudinal record</div></div>
  <div class="card"><div class="kicker">Relationships tested</div><div class="big">${esc(String((relationships.relationships || []).length))}</div><div class="small">Pairwise associations with short time lags</div></div>
</div>

<section>
<h2>1 · What changed</h2>
<p class="small">Overall change compares the latest 14 observed days with the preceding 28 observed days using daily medians. The final column shows the latest 7 observed days versus the prior 7.</p>
<table>
<thead><tr><th>Signal</th><th>Baseline</th><th>Recent</th><th>Overall</th><th>Last 7 vs prior 7</th><th>Persistent days</th></tr></thead>
<tbody>${changeRows}</tbody>
</table>
</section>

<section>
<h2>2 · Patterns that may be connected</h2>
<p class="small">These are statistical associations in this person's data, not proof that one variable caused another.</p>
<table>
<thead><tr><th>Signals</th><th>r</th><th>Strength</th><th>Paired observations</th><th>Strongest timing</th></tr></thead>
<tbody>${relationshipRows}</tbody>
</table>
</section>

<section>
<h2>3 · Patient-reported context</h2>
<table><thead><tr><th>Question</th><th>Latest recorded answer</th></tr></thead><tbody>${contextRows}</tbody></table>
</section>

<section class="page-break">
<h2>4 · Signal coverage</h2>
<p class="small">Shows how much longitudinal data is available for each numeric signal and the latest observed value.</p>
<table>
<thead><tr><th>Signal</th><th>Observed days</th><th>First date</th><th>Last date</th><th>Latest</th><th>Overall change</th></tr></thead>
<tbody>${coverageRows || '<tr><td colspan="6">No numeric signal coverage available.</td></tr>'}</tbody>
</table>
</section>

<section>
<h2>5 · Previous lab & medical documents</h2>
<p class="small">Original reports stored in PulseStory. The links open the source document so the clinician can review the exact report when needed.</p>
<table>
<thead><tr><th>Date</th><th>Report</th><th>Type</th><th>Provider</th><th>Notes / key results</th><th>File</th></tr></thead>
<tbody>${labRows}</tbody>
</table>
</section>

<section>
<h2>6 · Method & interpretation notes</h2>
<ul>
<li>Multiple readings on the same date are reduced to a daily median before change calculations.</li>
<li>Recent period: latest 14 observed days. Baseline period: preceding 28 observed days when available.</li>
<li>Persistent findings use the app's current deviation and persistence rules; smaller changes may still appear in the change table.</li>
<li>Relationships are pairwise Pearson associations evaluated across short lags. They are hypothesis-generating only.</li>
<li>Data shown here reflects the health story currently stored in PulseStory. Source units and original exports should be retained when exact raw measurements are needed.</li>
</ul>
</section>

<div class="footer">
PulseStory is a longitudinal health-data organization and interpretation aid. This brief is intended to support, not replace, clinical assessment.
</div>
</body></html>`);
}