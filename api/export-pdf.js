import { browser } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

export default async function(req,res){
  const profileKey = req.query?.profileKey || 'my-health-story';
  const base = new URL(req.url).origin;
  const reportUrl = base + '/doctor-report?profileKey=' + encodeURIComponent(profileKey);
  try {
    const pdf = await browser.pdf(reportUrl, { format:'A4', printBackground:true });
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','attachment; filename="PulseStory_Clinician_Brief.pdf"');
    res.setHeader('Cache-Control','no-store');
    return res.send(pdf);
  } catch (err) {
    console.error('PDF export failed', err);
    return res.status(500).json({ error:'Could not generate the clinician PDF.' });
  }
}