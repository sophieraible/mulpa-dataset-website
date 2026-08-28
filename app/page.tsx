'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import generatedData from './derived-data.json';
import { Participant, PhysiologyQc, TaskKey, participants, physiology, taskCards, taskColumns } from './data';

const assetBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type Channel = {
  id: string;
  x: number;
  y: number;
  type: 'long' | 'short';
  source: string;
  detector: string;
  region: string;
  distance: number;
  mni: number[];
};

type Optode = {
  id: string;
  type: 'source' | 'detector';
  x: number;
  y: number;
  mni: number[];
  position: string;
};

type SignalTrace = { key: string; label: string; unit: string; values: number[] };
type TaskSelection = (typeof taskCards)[number]['key'];
type PhysiologyKey = (typeof physiology)[number]['key'];
type QcMeasure = 'resp' | 'hr' | 'ppg' | 'ecg' | 'emg' | 'gsr';

const channels = generatedData.channels as Channel[];
const optodes = generatedData.optodes as Optode[];
const regions = Array.from(new Set(channels.map((channel) => channel.region))).sort();
const motorExample = generatedData.motorExample as {
  participant: string;
  eventDuration: number;
  time: number[];
  traces: SignalTrace[];
  channel: { id: string; source: string; detector: string; sourcePosition: string; detectorPosition: string };
  shortChannel: { id: string; source: string; detector: string; sourcePosition: string; detectorPosition: string };
};

const authorNames = ['Sophie Raible', 'João Pereira', 'Foivos Kotsogiannis', 'Bruno Direito', 'Teresa Sousa', 'Manuela da Cunha Seiffert', 'Rik Lavicka', 'Vendija Skeltona', 'Daniëlle Evenblij', 'Assunta Ciarlo', 'Armin Heinecke', 'Jacqueline Gädtke', 'Zeus Tipado', 'David M. A. Mehler', 'Simon H. Kohl', 'Miguel Castelo-Branco', 'Rainer Goebel', 'Michael Lührs', 'Bettina Sorger'];
const authors = `${authorNames.slice(0, -1).join(', ')}, and ${authorNames.at(-1)}`;
const citation = `${authors}. All signals considered: Data quality partially explains inter-individual task differences in a large, open fNIRS dataset. bioRxiv 2026.06.06.728412 (2026). https://doi.org/10.64898/2026.06.06.728412`;

const qcMeasures: QcMeasure[] = ['resp', 'hr', 'ppg', 'ecg', 'emg', 'gsr'];
const taskNames: Record<string, string> = {
  emotion: 'EMO · Emotion', motoraction: 'MA · Motor Action', motorimagery: 'MI · Motor Imagery',
  motorimageryfreqchange: 'MIFQ · Motor Imagery with Frequency Change', 'music_run-1': 'MUS1 · Music 1',
  'music_run-2': 'MUS2 · Music 2', restingstate: 'REST · Rest', visual: 'VIS · Vision',
};

const traceColors: Record<string, string> = {
  hbo: '#d62728', hbr: '#1f77b4', shortHbo: '#d62728', shortHbr: '#1f77b4', ppg: '#7c3aed', hr: '#b45309',
  spo2: '#0f766e', resp: '#00857a', ecg: '#d97706', gsr: '#a855f7',
  emg: '#9333ea', temp: '#64748b',
};

const taskDurations: Record<TaskSelection, number> = {
  emotion: 6,
  visual: 16,
  motorAction: 16,
  motorImagery: 16,
  motorFrequency: 16,
  music: 7,
  rest: 0,
};

// Pixel-traced from the supplied 732 × 732 flat-montage reference image.
// These coordinates intentionally preserve its non-uniform spacing.
const tracedPositions: Record<string, { x: number; y: number }> = {
  Fp1: { x: 38.11, y: 18.44 }, Fpz: { x: 49.04, y: 16.80 }, Fp2: { x: 59.84, y: 18.44 },
  AF7: { x: 28.14, y: 22.81 }, AF3: { x: 38.11, y: 25.41 }, AFz: { x: 49.04, y: 25.55 }, AF4: { x: 59.97, y: 25.41 }, AF8: { x: 70.22, y: 22.68 },
  F7: { x: 19.81, y: 30.60 }, F5: { x: 26.50, y: 33.06 }, F3: { x: 33.88, y: 34.15 }, F1: { x: 41.39, y: 34.02 }, Fz: { x: 49.04, y: 34.15 }, F2: { x: 56.83, y: 34.15 }, F4: { x: 64.34, y: 34.02 }, F6: { x: 71.58, y: 33.06 }, F8: { x: 78.69, y: 30.46 },
  FC5: { x: 22.81, y: 42.35 }, FC3: { x: 31.56, y: 42.35 }, FC1: { x: 40.30, y: 43.03 }, FCz: { x: 49.04, y: 43.03 }, FC2: { x: 57.79, y: 43.03 }, FC4: { x: 66.67, y: 42.21 }, FC6: { x: 75.41, y: 42.35 },
  T7: { x: 12.43, y: 52.05 }, C5: { x: 21.58, y: 51.91 }, C3: { x: 30.74, y: 52.19 }, C1: { x: 39.75, y: 52.05 }, Cz: { x: 49.04, y: 52.19 }, C2: { x: 58.20, y: 52.05 }, C4: { x: 67.62, y: 52.05 }, C6: { x: 76.78, y: 51.91 }, T8: { x: 85.66, y: 51.91 },
  TP7: { x: 14.21, y: 63.39 }, CP5: { x: 22.81, y: 62.16 }, CP3: { x: 31.56, y: 61.20 }, CP1: { x: 40.30, y: 61.20 }, CPz: { x: 49.04, y: 61.07 }, CP2: { x: 57.79, y: 61.20 }, CP4: { x: 66.67, y: 61.20 }, CP6: { x: 75.27, y: 62.16 }, TP8: { x: 83.88, y: 63.39 },
  P7: { x: 19.67, y: 73.50 }, P5: { x: 26.50, y: 71.04 }, P3: { x: 33.88, y: 69.95 }, P1: { x: 41.39, y: 69.81 }, Pz: { x: 49.04, y: 69.95 }, P2: { x: 56.83, y: 69.81 }, P4: { x: 64.34, y: 69.95 }, P6: { x: 71.58, y: 71.04 }, P8: { x: 78.69, y: 73.50 },
  PO3: { x: 38.11, y: 78.96 }, POz: { x: 49.04, y: 78.96 }, PO4: { x: 59.97, y: 78.96 },
  O1: { x: 37.98, y: 86.20 }, Oz: { x: 49.04, y: 86.89 }, O2: { x: 59.84, y: 86.20 },
  I1: { x: 35.66, y: 94.81 }, Iz: { x: 49.04, y: 95.90 }, I2: { x: 62.57, y: 94.81 },
};

const tracedOptodeLabels: Record<string, string> = {
  S1: 'Fpz', S2: 'AF4', S3: 'AF8', S4: 'Fz', S5: 'F4', S6: 'F8', S7: 'FC2', S8: 'FC6',
  S9: 'Cz', S10: 'C4', S11: 'T8', S12: 'CP2', S13: 'CP6', S14: 'Pz', S15: 'P4', S16: 'P8',
  S17: 'POz', S18: 'O1', S19: 'O2', S20: 'Iz', S21: 'P3', S22: 'P7', S23: 'CP1', S24: 'CP5',
  S25: 'C3', S26: 'T7', S27: 'FC1', S28: 'FC5', S29: 'F3', S30: 'F7', S31: 'AF3', S32: 'AF7',
  D1: 'Fp2', D2: 'AFz', D3: 'F2', D4: 'F6', D5: 'FCz', D6: 'FC4', D7: 'C2', D8: 'C6',
  D9: 'CPz', D10: 'CP4', D11: 'TP8', D12: 'P2', D13: 'P6', D14: 'PO4', D15: 'Oz', D16: 'I2',
  D17: 'I1', D18: 'PO3', D19: 'P1', D20: 'P5', D21: 'CP3', D22: 'TP7', D23: 'C1', D24: 'C5',
  D25: 'FC3', D26: 'F1', D27: 'F5', D28: 'Fp1',
};
const optodeById = new Map(optodes.map((optode) => [optode.id, optode]));
const shortChannels = channels.filter((channel) => channel.type === 'short');
const shortDetectorIds = new Set(shortChannels.map((channel) => channel.detector));

function flatPosition(optodeId: string) {
  return tracedPositions[tracedOptodeLabels[optodeId] ?? ''] ?? { x: 50, y: 50 };
}

function optodeReference(optodeId: string) {
  return tracedOptodeLabels[optodeId] ?? optodeById.get(optodeId)?.position ?? 'Unmapped';
}

function channelLineStyle(channel: Channel) {
  const source = flatPosition(channel.source);
  const detector = flatPosition(channel.detector);
  const dx = detector.x - source.x;
  const dy = detector.y - source.y;
  return {
    left: `${source.x}%`,
    top: `${source.y}%`,
    width: `${Math.hypot(dx, dy).toFixed(4)}%`,
    transform: `rotate(${Math.atan2(dy, dx).toFixed(5)}rad)`,
  };
}

function syntheticTrace(trace: SignalTrace, task: TaskSelection, time: number[]) {
  const taskIndex = Math.max(0, taskCards.findIndex((item) => item.key === task));
  const duration = taskDurations[task];
  return time.map((value, index) => {
    const active = duration > 0 && value >= 0 && value <= duration ? 1 : 0;
    const phase = index / Math.max(1, time.length - 1);
    const taskPhase = taskIndex * .37;
    if (trace.key === 'hbo') {
      const peak = Math.exp(-Math.pow((value - duration * .75) / 5.5, 2));
      return .2 * Math.sin(phase * 8 * Math.PI + taskPhase) + peak * (task === 'rest' ? .15 : .85);
    }
    if (trace.key === 'hbr') return -.14 * Math.sin(phase * 8 * Math.PI + taskPhase) - .48 * Math.exp(-Math.pow((value - duration * .75) / 5.5, 2));
    if (trace.key === 'short') return .42 * Math.sin(phase * 13 * Math.PI + taskPhase) + .14 * active;
    if (trace.key === 'ppg') return .8 * Math.sin(phase * 54 * Math.PI + taskPhase);
    if (trace.key === 'resp') return .85 * Math.sin(phase * 6 * Math.PI + taskPhase);
    if (trace.key === 'ecg') return Math.pow(Math.max(0, Math.sin(phase * 54 * Math.PI)), 10) - .16;
    if (trace.key === 'emg') return active * (.58 * Math.sin(phase * 115 * Math.PI) + .3 * Math.sin(phase * 173 * Math.PI));
    if (trace.key === 'gsr') return .18 * Math.sin(phase * 2 * Math.PI) + active * .38;
    if (trace.key === 'hr') return .16 * Math.sin(phase * 3 * Math.PI) + active * .22;
    if (trace.key === 'spo2') return .16 * Math.sin(phase * 1.7 * Math.PI + 1.2);
    return .1 * Math.sin(phase * Math.PI);
  });
}

function MontageExplorer() {
  const [showLong, setShowLong] = useState(true);
  const [showShort, setShowShort] = useState(true);
  const [showOptodes, setShowOptodes] = useState(true);
  const [region, setRegion] = useState('All regions');
  const [active, setActive] = useState<Channel>(channels[35]);

  const visible = channels.filter((channel) => {
    const typeIsVisible = channel.type === 'long' ? showLong : showShort;
    return typeIsVisible && (region === 'All regions' || channel.region === region);
  });
  const visibleRegular = visible.filter((channel) => channel.type === 'long');
  const visibleShort = new Map(visible.filter((channel) => channel.type === 'short').map((channel) => [channel.source, channel]));
  const displayOptodes = optodes.filter((optode) => !shortDetectorIds.has(optode.id));

  return (
    <section className="section montage-section" id="montage">
      <div className="section-heading dark-heading">
        <div><p className="eyebrow">fNIRS montage</p><h2>Whole-head coverage, channel by channel</h2></div>
        <p>Hover or focus a connection to inspect its anatomical coverage.</p>
      </div>

      <div className="montage-card">
        <div className="montage-controls">
          <button className={`layer-toggle long ${showLong ? 'active' : ''}`} onClick={() => setShowLong(!showLong)} aria-pressed={showLong}><span /> Regular channels <b>102</b></button>
          <button className={`layer-toggle short ${showShort ? 'active' : ''}`} onClick={() => setShowShort(!showShort)} aria-pressed={showShort}><span /> Short channels <b>32</b></button>
          <button className={`layer-toggle optode ${showOptodes ? 'active' : ''}`} onClick={() => setShowOptodes(!showOptodes)} aria-pressed={showOptodes}><span /> Sources + detectors <b>92</b></button>
          <label className="region-filter"><span>Region</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option>All regions</option>{regions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <p className="visible-count">{visible.length} visible</p>
        </div>

        <div className="montage-layout">
          <div className="head-map" aria-label="Flat 10–20 view of the sub-01 MULPA fNIRS montage">
            <svg className="head-outline" viewBox="0 0 732 732" aria-hidden="true">
              <path d="M278 70 C224 80 156 101 109 139 C49 188 24 280 22 369 C20 473 60 565 132 624 C179 663 225 683 282 695 M438 70 C492 80 560 101 607 139 C667 188 692 280 694 369 C696 473 656 565 584 624 C537 663 491 683 434 695" />
              <path d="M278 70 C304 64 332 62 359 62 C386 62 413 64 438 70 M278 70 C301 57 331 11 359 11 C387 11 416 57 438 70" />
              <path d="M23 332 C6 325 0 348 0 392 C0 436 7 460 22 456 C34 451 32 424 32 392 C32 361 35 337 23 332 M694 332 C711 325 718 348 718 392 C718 436 711 460 696 456 C684 451 686 424 686 392 C686 361 683 337 694 332" />
              <line className="midline" x1="359" y1="62" x2="359" y2="702" /><line className="midline" x1="31" y1="381" x2="687" y2="381" />
              <path className="guide-arc" d="M42 277 Q359 447 676 277 M67 539 Q359 384 651 539" />
            </svg>
            {visibleRegular.map((channel) => (
              <button key={channel.id} className={`channel-line ${channel.type} ${active.id === channel.id ? 'selected' : ''}`} style={channelLineStyle(channel)} onMouseEnter={() => setActive(channel)} onFocus={() => setActive(channel)} onClick={() => setActive(channel)} aria-label={`${channel.id}, ${channel.source} to ${channel.detector}, ${channel.region}`} />
            ))}
            {showOptodes && displayOptodes.map((optode) => {
              const point = flatPosition(optode.id);
              const pairedShort = optode.type === 'source' ? visibleShort.get(optode.id) : undefined;
              return (
                <span className={`optode-node ${optode.type} ${pairedShort ? 'paired-short' : ''}`} key={optode.id} style={{ left: `${point.x}%`, top: `${point.y}%` }} title={`${optodeReference(optode.id)} · ${optode.id}${pairedShort ? ` · ${pairedShort.detector}` : ''}`}>
                  <b>{optodeReference(optode.id)}</b><small>{optode.id}{pairedShort ? ` · ${pairedShort.detector}` : ''}</small>
                </span>
              );
            })}
            {Array.from(visibleShort.values()).map((channel) => {
              const point = flatPosition(channel.source);
              return <button key={channel.id} className={`short-channel-hit ${active.id === channel.id ? 'selected' : ''}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} onMouseEnter={() => setActive(channel)} onFocus={() => setActive(channel)} onClick={() => setActive(channel)} aria-label={`${channel.id}, short channel ${channel.source} to ${channel.detector}, ${channel.region}`} />;
            })}
          </div>

          <aside className="channel-inspector" aria-live="polite">
            <p className="inspector-label">Selected channel</p>
            <div className="channel-title"><span className={`channel-swatch ${active.type}`} /><h3>{active.id}</h3><span className="channel-type">{active.type === 'short' ? 'Short' : 'Regular'}</span></div>
            <dl><div><dt>Source–detector pair</dt><dd>{active.source} – {active.detector}</dd></div><div><dt>10–20 reference</dt><dd>{active.type === 'short' ? optodeReference(active.source) : `${optodeReference(active.source)} – ${optodeReference(active.detector)}`}</dd></div><div><dt>Distance</dt><dd>{active.distance} mm</dd></div><div><dt>Midpoint</dt><dd>{active.mni.join(', ')} mm</dd></div><div><dt>Anatomical region</dt><dd>{active.region}</dd></div><div><dt>Coordinate space</dt><dd>{generatedData.coordinateSystem}</dd></div></dl>
            <p className="provisional-note"><strong>Atlas note.</strong> Positions and pairs come from the supplied BIDS/SNIRF files. The sidecar specifies MNI space, but no cortical parcellation; region names are broad approximations until authoritative fOLD output is supplied.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

function allTasksComplete(participant: Participant) {
  return taskColumns.every((task) => participant.tasks[task.key]);
}

function ParticipantExplorer() {
  const [search, setSearch] = useState('');
  const [sex, setSex] = useState('All');
  const [requiredTask, setRequiredTask] = useState<'all' | 'any' | TaskKey>('any');
  const [physioQc, setPhysioQc] = useState('any');
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'id', direction: 'asc' });

  const filtered = useMemo(() => participants.filter((participant) => {
    const matchesSearch = participant.id.toLowerCase().includes(search.toLowerCase());
    const matchesSex = sex === 'All' || participant.sex === sex;
    const matchesTask = requiredTask === 'any' || (requiredTask === 'all' ? allTasksComplete(participant) : participant.tasks[requiredTask]);
    const matchesPhysio = physioQc === 'any' || (physioQc === 'complete' && participant.physiologyQc.overall === 100) || (physioQc === 'high' && participant.physiologyQc.overall >= 90) || (physioQc === 'review' && participant.physiologyQc.overall < 90);
    return matchesSearch && matchesSex && matchesTask && matchesPhysio;
  }).sort((a, b) => {
    const value = (participant: Participant) => {
      if (sort.key === 'id') return participant.id;
      if (sort.key === 'age') return participant.age;
      if (sort.key === 'sex') return participant.sex;
      if (sort.key === 'handedness') return participant.handedness;
      if (sort.key === 'headSize') return participant.headSize ?? -1;
      if (sort.key === 'questionnaires') return Number(participant.questionnaires);
      if (sort.key === 'overall') return participant.physiologyQc.overall;
      if (qcMeasures.includes(sort.key as QcMeasure)) return participant.physiologyQc[sort.key as QcMeasure];
      return Number(participant.tasks[sort.key as TaskKey]);
    };
    const left = value(a); const right = value(b);
    const comparison = typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right) : Number(left) - Number(right);
    return sort.direction === 'asc' ? comparison : -comparison;
  }), [physioQc, requiredTask, search, sex, sort]);
  const setSortKey = (key: string) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const sortMark = (key: string) => sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '';
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const summary = {
    age: average(participants.map((participant) => participant.age)),
    female: participants.filter((participant) => participant.sex === 'Female').length / participants.length,
    male: participants.filter((participant) => participant.sex === 'Male').length / participants.length,
    questionnaires: participants.filter((participant) => participant.questionnaires).length / participants.length,
    headSize: average(participants.flatMap((participant) => participant.headSize === null ? [] : [participant.headSize])),
  };
  const SortHeader = ({ label, sortKey, title }: { label: string; sortKey: string; title?: string }) => <th title={title}><button className="sort-button" onClick={() => setSortKey(sortKey)}>{label}{sortMark(sortKey)}</button></th>;

  return (
    <section className="section participants-section" id="participants">
      <div className="section-heading light-heading"><div><p className="eyebrow">Participant explorer</p><h2>Check the release before downloading</h2></div><p>Filter participant metadata, task completeness, and run-level data quality of physiology measures.</p></div>
      <div className="explorer-card">
        <div className="filter-bar">
          <label><span>Participant</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sub-01…" /></label>
          <label><span>Sex metadata</span><select value={sex} onChange={(event) => setSex(event.target.value)}><option>All</option><option>Female</option><option>Male</option><option>Missing</option></select></label>
          <label><span>Task completeness</span><select value={requiredTask} onChange={(event) => setRequiredTask(event.target.value as 'all' | 'any' | TaskKey)}><option value="any">No restriction</option><option value="all">All eight runs</option>{taskColumns.map((task) => <option key={task.key} value={task.key}>{task.label}</option>)}</select></label>
          <label><span>Physiology quality control</span><select value={physioQc} onChange={(event) => setPhysioQc(event.target.value)}><option value="any">Any pass rate</option><option value="complete">100% of checks</option><option value="high">90% or higher</option><option value="review">Below 90%</option></select></label>
          <p className="match-count"><strong>{filtered.length}</strong> of 57</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><SortHeader label="Participant" sortKey="id" /><SortHeader label="Age" sortKey="age" /><SortHeader label="Sex" sortKey="sex" /><SortHeader label="Handedness" sortKey="handedness" /><SortHeader label="Head size" sortKey="headSize" /><SortHeader label="Questionnaires" sortKey="questionnaires" />{taskColumns.map((task) => <SortHeader key={task.key} label={task.short} sortKey={task.key} title={task.label} />)}<th className="qc-start"><button className="sort-button" onClick={() => setSortKey('overall')}>Physio QC{sortMark('overall')}</button></th>{qcMeasures.map((measure) => <SortHeader key={measure} label={measure.toUpperCase()} sortKey={measure} />)}</tr></thead>
            <tbody>{filtered.map((participant) => (
              <tr key={participant.id}>
                <th>{participant.id}</th><td>{participant.age}</td><td>{participant.sex}</td><td>{participant.handedness}</td><td>{participant.headSize ? `${participant.headSize} cm` : 'Missing'}</td><td><Availability available={participant.questionnaires} /></td>
                {taskColumns.map((task) => <td key={task.key} title={`${task.label}: ${participant.tasks[task.key] ? 'complete' : 'incomplete or missing'}`}><Availability available={participant.tasks[task.key]} compact /></td>)}
                <td className="qc-start"><QcRate qc={participant.physiologyQc} /></td>
                {qcMeasures.map((measure) => <td key={measure}><QcRate qc={participant.physiologyQc} measure={measure} compact /></td>)}
              </tr>
            ))}</tbody>
            <tfoot><tr><th>All 57</th><td>Mean {summary.age.toFixed(1)}</td><td>F {percent(summary.female)}<br />M {percent(summary.male)}</td><td>L {percent(participants.filter((participant) => participant.handedness === 'Left').length / participants.length)}<br />R {percent(participants.filter((participant) => participant.handedness === 'Right').length / participants.length)}</td><td>Mean {summary.headSize.toFixed(1)} cm</td><td>{percent(summary.questionnaires)} complete</td>{taskColumns.map((task) => <td key={task.key}>{percent(participants.filter((participant) => participant.tasks[task.key]).length / participants.length)}</td>)}<td className="qc-start">Mean {average(participants.map((participant) => participant.physiologyQc.overall)).toFixed(0)}%</td>{qcMeasures.map((measure) => <td key={measure}>Mean {average(participants.map((participant) => participant.physiologyQc[measure])).toFixed(0)}%</td>)}</tr></tfoot>
          </table>
        </div>
        <p className="table-note">Quality-control values summarize data quality, not whether a recording exists. A lower value can reflect hardware problems or sensor-attachment issues in a run.</p>
      </div>
    </section>
  );
}

function Availability({ available, compact = false }: { available: boolean; compact?: boolean }) {
  return <span className={`availability ${available ? 'yes' : 'no'} ${compact ? 'compact' : ''}`}>{compact ? (available ? '✓' : '—') : available ? 'Complete' : 'Missing'}</span>;
}

function QcRate({ qc, measure, compact = false }: { qc: PhysiologyQc; measure?: QcMeasure; compact?: boolean }) {
  const [popoverPosition, setPopoverPosition] = useState<{ left: number; top: number } | null>(null);
  const value = measure ? qc[measure] : qc.overall;
  const status = value === 100 ? 'complete' : value >= 90 ? 'high' : value >= 75 ? 'partial' : 'review';
  const showPopover = (target: HTMLElement) => {
    const bounds = target.getBoundingClientRect();
    const width = measure ? 250 : 510;
    setPopoverPosition({
      left: Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)),
      top: Math.max(12, Math.min(bounds.bottom + 8, window.innerHeight - 330)),
    });
  };
  return (
      <span className="qc-cell" tabIndex={0} onMouseEnter={(event) => showPopover(event.currentTarget)} onMouseLeave={() => setPopoverPosition(null)} onFocus={(event) => showPopover(event.currentTarget)} onBlur={() => setPopoverPosition(null)} aria-label={`${measure ? measure.toUpperCase() : 'All physiology'}: ${value}% data-quality pass rate. Focus to inspect each run.`}>
      <span className={`qc-rate ${status} ${compact ? 'compact' : ''}`}>{value}%</span>
      {popoverPosition && <span className={`qc-popover ${measure ? 'single-measure' : 'all-measures'}`} style={popoverPosition} role="tooltip">
        <strong>{measure ? `${measure.toUpperCase()} data quality` : 'Physiology data quality by run'}</strong>
        {measure ? (
          <span className="qc-run-list">
            {qc.runDetails.map((run) => <span key={run.task}><b>{taskNames[run.task]}</b><i className={run[measure] ? 'available' : 'missing'} />{run[measure] ? 'Pass' : 'Needs review'}</span>)}
          </span>
        ) : (
          <span className="qc-run-matrix">
            <span className="qc-matrix-row header"><b>Run</b>{qcMeasures.map((item) => <b key={item}>{item.toUpperCase()}</b>)}</span>
            {qc.runDetails.map((run) => <span className="qc-matrix-row" key={run.task}><b>{taskNames[run.task]}</b>{qcMeasures.map((item) => <i key={item} className={run[item] ? 'available' : 'missing'} title={`${item.toUpperCase()}: ${run[item] ? 'pass' : 'needs review'}`} />)}</span>)}
          </span>
        )}
      </span>}
    </span>
  );
}

function TaskCards() {
  return (
    <section className="section tasks-section" id="tasks">
      <div className="section-heading light-heading"><div><p className="eyebrow">7 different tasks</p><h2>Task paradigms</h2></div><p>Task cards summarize the paradigms included in the release. The synchronized example below is fixed to motor action.</p></div>
      <div className="task-grid">{taskCards.map((task) => (
        <article className={`task-card ${task.key === 'motorAction' ? 'motor-action' : ''}`} key={task.key}>
          <span className="task-number">{task.number}</span><p className="task-count">{task.count}</p><h3>{task.name}</h3><p className="task-design">{task.design}</p><p>{task.description}</p>
        </article>
      ))}</div>
    </section>
  );
}

function PhysiologyInventory({ selected, onToggle }: { selected: PhysiologyKey[]; onToggle: (key: PhysiologyKey) => void }) {
  const completeParticipants = participants.filter((participant) => participant.physiologyQc.overall === 100).length;
  return (
    <section className="section physiology-section" id="physiology">
      <div className="section-heading light-heading"><div><p className="eyebrow">Synchronized physiology</p><h2>Choose what to view beside fNIRS</h2></div><p>Select any combination. Every measure shares the fNIRS timeline and event triggers and is included in the .snirf file.</p></div>
      <div className="physiology-grid">{physiology.map((signal, index) => (
        <button className={`physiology-card ${selected.includes(signal.key) ? 'selected' : ''}`} key={signal.code} onClick={() => onToggle(signal.key)} aria-pressed={selected.includes(signal.key)}>
          <span className="physiology-number">{String(index + 1).padStart(2, '0')}</span><span className="physiology-code">{signal.code}</span><h3>{signal.name}</h3><p>{signal.kind}</p><span className="included-label">{selected.includes(signal.key) ? 'Shown below' : 'Add to plot'}</span>
        </button>
      ))}</div>
      <div className="physiology-summary"><strong>{completeParticipants} / 57 participants</strong><span>have a 100% pass rate across all physiology checks in the supplied quality-control file.</span></div>
    </section>
  );
}

function SynchronizedSignals({ selectedSignals }: { selectedSignals: PhysiologyKey[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const task: TaskSelection = 'motorAction';
  const selectedTask = taskCards.find((item) => item.key === task)!;
  const traces = useMemo(() => motorExample.traces.filter((trace) => trace.key === 'hbo' || trace.key === 'hbr' || trace.key === 'shortHbo' || trace.key === 'shortHbr' || selectedSignals.includes(trace.key as PhysiologyKey)), [selectedSignals]);
  const isMeasuredExample = task === 'motorAction';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = bounds.width * ratio; canvas.height = bounds.height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const width = bounds.width; const height = bounds.height; const left = 20; const right = 18; const plotWidth = width - left - right; const rowHeight = height / traces.length;
      context.clearRect(0, 0, width, height);
      const duration = taskDurations[task];
      if (duration > 0) {
        const timeRange = motorExample.time.at(-1)! - motorExample.time[0];
        const startX = left + ((0 - motorExample.time[0]) / timeRange) * plotWidth;
        const endX = left + ((duration - motorExample.time[0]) / timeRange) * plotWidth;
        context.fillStyle = 'rgba(255, 210, 0, .18)'; context.fillRect(startX, 0, endX - startX, height);
      }
      traces.forEach((trace, row) => {
        const values = isMeasuredExample ? trace.values : syntheticTrace(trace, task, motorExample.time);
        const baseline = rowHeight * row + rowHeight / 2;
        context.setLineDash([]); context.strokeStyle = '#d8e0e7'; context.lineWidth = 1; context.beginPath(); context.moveTo(left, baseline); context.lineTo(width - right, baseline); context.stroke();
        context.strokeStyle = traceColors[trace.key] || '#001c3d'; context.lineWidth = trace.key === 'hbo' || trace.key === 'hbr' ? 2.4 : 1.6; context.setLineDash(trace.key.startsWith('short') ? [5, 3] : []); context.beginPath();
        values.forEach((value, index) => { const x = left + (index / (values.length - 1)) * plotWidth; const y = baseline - value * rowHeight * .33; if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); });
        context.stroke(); context.setLineDash([]);
      });
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(canvas); return () => observer.disconnect();
  }, [isMeasuredExample, task, traces]);

  return (
    <section className="signals-section" id="signals">
      <div className="section signals-inner">
        <div className="section-heading light-heading"><div><p className="eyebrow">Synchronized example</p><h2>One timeline, many measures</h2></div><p>This example shows pre-processed fNIRS data for the motor-action task of one example subject. Select physiology measures above to show how they synchronize with fNIRS.</p></div>
        <div className="signal-card">
          <div className="signal-toolbar"><div><span className={`data-badge ${isMeasuredExample ? 'measured' : ''}`}>{isMeasuredExample ? 'Measured SNIRF example' : 'Generated preview'}</span><h3>{selectedTask.name} · {isMeasuredExample ? motorExample.participant : 'interaction preview'}</h3></div><p>{isMeasuredExample ? <><span>{motorExample.channel.id} · {motorExample.channel.source}–{motorExample.channel.detector} · {motorExample.channel.sourcePosition}–{motorExample.channel.detectorPosition}</span><span className="short-channel-reference">Short channel · {motorExample.shortChannel.id} · {motorExample.shortChannel.source}–{motorExample.shortChannel.detector}</span></> : `${traces.length} synchronized traces`}</p></div>
          <div className="signal-plot"><div className="signal-labels">{traces.map((trace) => <span key={trace.key}><i style={{ background: traceColors[trace.key] }} /><b>{trace.label}</b><small>{trace.unit}</small></span>)}</div><canvas ref={canvasRef} style={{ height: `${Math.max(300, traces.length * 64)}px` }} aria-label={`Synchronized ${selectedTask.name} fNIRS and physiology traces`} /></div>
          <div className="signal-axis"><span>−10 s</span><span>0 s</span><span>16 s</span><span>36 s</span></div>
          <p className="signal-note">Signals are normalized independently for visual comparison. The yellow band marks the selected task block.</p>
        </div>
      </div>
    </section>
  );
}

function CitationSection() {
  const [copyLabel, setCopyLabel] = useState('Copy citation');
  const copyCitation = async () => {
    await navigator.clipboard.writeText(citation);
    setCopyLabel('Copied');
    window.setTimeout(() => setCopyLabel('Copy citation'), 1600);
  };

  return (
    <section className="section citation-section" id="cite">
      <div className="section-heading light-heading"><div><p className="eyebrow">How to cite</p><h2>Cite the accompanying preprint</h2></div><p>Please use this citation when publishing analyses based on the MULPA release.</p></div>
      <div className="citation-card">
        <div className="citation-copy">
          <p>{citation}</p>
          <div className="citation-actions"><button onClick={copyCitation}>{copyLabel}</button><a href="https://doi.org/10.64898/2026.06.06.728412" target="_blank" rel="noreferrer">Open DOI ↗</a></div>
        </div>
        <a className="license-card" href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer" aria-label="Creative Commons Attribution-NonCommercial 4.0 International license">
          <span>Dataset license</span><strong>CC BY-NC 4.0</strong><small>Attribution · Non-commercial</small>
        </a>
      </div>
    </section>
  );
}

export default function Home() {
  const [selectedSignals, setSelectedSignals] = useState<PhysiologyKey[]>(['ppg', 'resp', 'ecg', 'emg']);
  const toggleSignal = (key: PhysiologyKey) => setSelectedSignals((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="MULPA home"><img className="header-logo" src={`${assetBasePath}/maastricht-university-logo.png`} alt="Maastricht University" /></a>
        <nav aria-label="Main navigation"><a href="#montage">Montage</a><a href="#participants">Participants</a><a href="#tasks">Tasks</a><a href="#physiology">Physiology</a><a href="#signals">Example</a><a href="#cite">Cite</a></nav>
        <a className="button button-small" href="https://zenodo.org/records/21033499" target="_blank" rel="noreferrer">Open dataset</a>
      </header>
      <section className="hero" id="top">
        <div><p className="eyebrow">A multiple-paradigm physiology-rich fNIRS resource</p><h1>The MULPA dataset</h1><p className="author-list">{authorNames.map((name, index) => <span key={name}>{name}{index < 2 && <sup>*</sup>}{index < authorNames.length - 2 ? ', ' : index === authorNames.length - 2 ? ', and ' : ''}</span>)}</p><div className="author-notes"><span><sup>*</sup> Shared first authors</span><a href="mailto:sp.raible@maastrichtuniversity.nl">Correspondence: sp.raible@maastrichtuniversity.nl</a></div><p className="hero-copy">MULPA is an open resource from 57 participants that combines near-whole-head fNIRS—134 measurement channels including 32 short-separation channels—with a broad, seven-task battery. The release brings cortical signals together with synchronized cardiovascular, respiratory, electrodermal, muscular, behavioural, and self-report measures on shared timelines: a rich foundation for studying brain responses, systemic physiology, signal quality, and their interactions.</p><div className="hero-actions"><a className="button" href="#montage">Explore the montage</a><a className="text-link" href="https://www.biorxiv.org/content/10.64898/2026.06.06.728412v1" target="_blank" rel="noreferrer">Read the preprint <span aria-hidden="true">↗</span></a></div></div>
        <dl className="stat-grid"><div><dt>57</dt><dd>participants</dd></div><div><dt>134</dt><dd>fNIRS channels</dd></div><div><dt>32</dt><dd>short channels</dd></div><div><dt>7</dt><dd>different tasks</dd></div><div><dt>12.6 Hz</dt><dd>sampling rate</dd></div><div><dt>30+ h</dt><dd>recordings</dd></div></dl>
      </section>
      <section className="dataset-overview" aria-label="MULPA dataset overview">
        <img src={`${assetBasePath}/mulpa-dataset-overview.png`} alt="Overview of the MULPA dataset: fNIRS, synchronized physiology, a broad task battery, and behavioural measures in 57 participants." />
      </section>
      <MontageExplorer />
      <ParticipantExplorer />
      <TaskCards />
      <PhysiologyInventory selected={selectedSignals} onToggle={toggleSignal} />
      <SynchronizedSignals selectedSignals={selectedSignals} />
      <CitationSection />
      <footer>
        <div><a className="brand" href="#top"><img className="footer-logo" src={`${assetBasePath}/maastricht-university-logo-white.png`} alt="Maastricht University" /></a></div>
        <div className="footer-links"><a href="https://zenodo.org/records/21033499" target="_blank" rel="noreferrer">Dataset ↗</a><a href="https://www.biorxiv.org/content/10.64898/2026.06.06.728412v1" target="_blank" rel="noreferrer">Preprint ↗</a></div>
        <div className="footer-meta"><p className="license">BIDS 1.11.1 · SNIRF · CC BY-NC 4.0</p><p className="prototype-note">MNI region labels remain provisional until fOLD output is available.</p><p className="prototype-note">Website created by Sophie Raible using Codex (GPT-5).</p><p className="site-version">Last updated: 27 August 2026</p></div>
      </footer>
    </main>
  );
}
