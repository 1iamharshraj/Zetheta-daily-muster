import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireHr } from '@/lib/auth';
import { getPeople, getHr } from '@/lib/data';
import { shortName } from '@/lib/names';
import { Topbar } from '@/components/Shell';
import { ProfileForm } from '@/components/ProfileForm';

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  await requireHr();
  const { id } = await params;
  const p = (await getPeople()).find((x) => x.id === +id);
  if (!p) notFound();
  const hr = await getHr(p.id);
  return (
    <>
      <Topbar title="Employee record" />
      <main id="app" className="anim">
        <div className="toolbar"><div>
          <Link className="link back" href="/hr/records">← Back to employee records</Link>
          <h2 className="nmh">{shortName(p.fullName)}<span className="eno-tag">{p.empNo}</span></h2>
          {p.email && <span className="role">{p.email}</span>}
        </div></div>
        <ProfileForm mode="hr" personId={p.id} empNo={p.empNo} email={p.email || ''} fullName={p.fullName} photo={p.photo}
          personal={hr?.personal || {}} job={hr?.job || {}} />
      </main>
    </>
  );
}
