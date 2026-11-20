'use client';

import { useEffect, useRef, useState } from 'react';

type Recording = {
  participant: string;
  task: string;
  run: string | null;
  complete: boolean | null;
  bytes: number;
  path: string;
};

let taskLabels: Record<string, string> = {
  restingstate: 'Resting state',
  motoraction: 'Motor action',
  motorimagery: 'Motor imagery',
  motorimageryfreqchange: 'Motor imagery with frequency change',
  emotion: 'Emotion',
  visual: 'Visual',
  music: 'Music',
};
let assetBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
let viewerBaseUrl = process.env.NEXT_PUBLIC_SATORI_VIEWER_URL
  ?? 'https://download.brain-innovation.com/Satori/SatoriEDU/';

function recordingLabel(recording: Recording) {
  return (taskLabels[recording.task] ?? recording.task)
    + (recording.run === null ? '' : ` · Run ${recording.run}`);
}

function RecordingViewer({ recording, viewerUrl }: { recording: Recording; viewerUrl: string }) {
  let iframe = useRef<HTMLIFrameElement>(null);
  let [initialUrl] = useState(viewerUrl);
  let [frameUrl, setFrameUrl] = useState('');

  useEffect(() => {
    let url = new URL(initialUrl);
    url.searchParams.set('parentOrigin', window.location.origin);
    setFrameUrl(url.href);
  }, [initialUrl]);
  let [selection, setSelection] = useState({ url: viewerUrl, generation: 0, retry: 0 });
  let [state, setState] = useState<{
    generation: number;
    requestId: number;
    status: 'loading' | 'ready' | 'error';
    message: string;
    fatal: boolean;
  }>({ generation: 0, requestId: 0, status: 'loading', message: 'Opening the viewer…', fatal: false });
  let channel = useRef({ ready: false, requestId: 0, dataset: '', retry: 0, fatal: false });

  // A selection generation prevents A → B → A from briefly exposing the old A
  // while B is still loading. The iframe itself stays mounted throughout.
  if (selection.url !== viewerUrl) {
    setSelection({ url: viewerUrl, generation: selection.generation + 1, retry: selection.retry });
  }

  useEffect(() => {
    let frame = iframe.current;
    if (!frame || !frameUrl) return;
    let viewer = new URL(initialUrl, window.location.href);
    let desired = new URL(selection.url, window.location.href);
    let dataset = new URL(desired.searchParams.get('dataset')!, desired).href;
    if (!channel.current.dataset)
      channel.current.dataset = new URL(viewer.searchParams.get('dataset')!, viewer).href;

    function requestDataset() {
      let active = channel.current;
      if (!active.ready || active.fatal || !frame?.contentWindow) return;
      if (active.dataset === dataset && active.retry === selection.retry) return;
      if (active.requestId >= 2147483647) {
        active.fatal = true;
        setState({ generation: selection.generation, requestId: active.requestId,
          status: 'error', message: 'Reload this page to continue switching recordings.', fatal: true });
        return;
      }
      ++active.requestId;
      active.dataset = dataset;
      active.retry = selection.retry;
      frame.contentWindow.postMessage({ type: 'satori:load', requestId: active.requestId, dataset }, viewer.origin);
    }

    function receive(event: MessageEvent) {
      if (event.source !== frame?.contentWindow || event.origin !== viewer.origin) return;
      let message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'satori:ready') {
        channel.current.ready = true;
        requestDataset();
        return;
      }
      let active = channel.current;
      if (message.type !== 'satori:state' || !Number.isSafeInteger(message.requestId)
        || message.requestId < 0 || message.requestId > 2147483647
        || typeof message.dataset !== 'string'
        || !['loading', 'ready', 'error'].includes(message.status) || typeof message.message !== 'string') return;
      let fatal = message.status === 'error' && message.fatal === true;
      // A runtime exit can precede receipt of our latest load command. It affects
      // every request, including one whose ID the frame has not acknowledged yet.
      if (!fatal && (active.fatal || message.requestId !== active.requestId || message.dataset !== active.dataset
        || message.dataset !== dataset || active.retry !== selection.retry)) return;
      if (fatal) active.fatal = true;
      setState({ generation: selection.generation, requestId: message.requestId,
        status: message.status, message: message.message.slice(0, 2048), fatal });
    }

    window.addEventListener('message', receive);
    frame.contentWindow?.postMessage({ type: 'satori:connect' }, viewer.origin);
    requestDataset();
    return () => window.removeEventListener('message', receive);
  }, [initialUrl, frameUrl, selection]);

  let current = state.fatal || state.generation === selection.generation ? state
    : { status: 'loading', message: 'Opening recording…', requestId: -1, fatal: false };
  let blocked = current.status !== 'ready';
  let overlay = current.status === 'error' || (blocked && (selection.generation > 0 || current.requestId > 0));

  return <>
    <div className="satori-recording" aria-live="polite">
      <strong>{current.status === 'ready' ? 'Loaded' : current.status === 'error' ? 'Unable to load' : 'Loading'}
        {' · '}{recording.participant} · {recordingLabel(recording)}</strong>
      <span>{(recording.bytes / 1024 / 1024).toFixed(1)} MiB · SNIRF</span>
      {recording.complete === false && <span className="satori-incomplete">Incomplete recording</span>}
      {recording.complete === null && <span>Completeness not reported</span>}
    </div>
    <div className="satori-frame-wrap" aria-busy={current.status === 'loading'}>
      <div className="satori-frame-scroll">
        {frameUrl && <iframe ref={iframe} src={frameUrl} loading="lazy" allow="fullscreen" allowFullScreen
          inert={blocked} tabIndex={blocked ? -1 : 0} aria-hidden={blocked || undefined}
          onLoad={() => iframe.current?.contentWindow?.postMessage({ type: 'satori:connect' },
            new URL(initialUrl, window.location.href).origin)}
          onError={() => {
            channel.current.fatal = true;
            setState({ generation: selection.generation, requestId: channel.current.requestId,
              status: 'error', message: 'The viewer could not be loaded. Reload this page to try again.', fatal: true });
          }}
          title={`Satori Viewer — ${recording.participant}, ${recordingLabel(recording)}`} aria-describedby="satori-note" />}
      </div>
      {overlay && <div className="satori-frame-overlay" role={current.status === 'error' ? 'alert' : 'status'}>
        <div>
          {current.status === 'loading' && <span className="satori-loading-ring" aria-hidden="true" />}
          <strong>{current.status === 'error' ? 'This recording could not be opened' : 'Opening recording…'}</strong>
          <p>{current.message || (current.status === 'error' ? 'Try again or choose another recording.' : 'Preparing the recording for viewing.')}</p>
          {current.status === 'error' && <button className="button" type="button" onClick={() => {
            if (current.fatal) window.location.reload();
            else setSelection((value) => ({ ...value, generation: value.generation + 1, retry: value.retry + 1 }));
          }}>{current.fatal ? 'Reload page' : 'Try again'}</button>}
        </div>
      </div>}
    </div>
    <p className="satori-note" id="satori-note">Changing participant or task opens the selected recording in the same viewer session.
      {recording.complete === false && ' This recording is marked incomplete in the dataset metadata; interpret it accordingly.'}
      <span className="satori-small-screen"> On a small screen, scroll within the viewer or open it in a new tab.</span>
    </p>
  </>;
}

export default function SatoriViewer() {
  let [recordings, setRecordings] = useState<Recording[]>([]);
  let [participant, setParticipant] = useState('sub-01');
  let [task, setTask] = useState('motoraction:');
  let [error, setError] = useState(false);
  let [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let controller = new AbortController();
    async function loadCatalog() {
      setError(false);
      try {
        let response = await fetch(`${assetBasePath}/satori-catalog.json`, { signal: controller.signal });
        if (!response.ok) throw new Error('Catalog unavailable');
        let catalog = await response.json();
        if (!catalog || typeof catalog !== 'object' || !('version' in catalog) || catalog.version !== 1
          || !('entries' in catalog) || !Array.isArray(catalog.entries) || !catalog.entries.length
          || !catalog.entries.every((entry: Recording) => entry
            && /^sub-\d+$/.test(entry.participant) && /^[a-z0-9]+$/.test(entry.task)
            && (entry.run === null || (typeof entry.run === 'string' && /^\d+$/.test(entry.run)))
            && (entry.complete === null || typeof entry.complete === 'boolean')
            && Number.isSafeInteger(entry.bytes) && entry.bytes > 0
            && entry.path === `${entry.participant}/nirs/${entry.participant}_task-${entry.task}`
              + (entry.run === null ? '' : `_run-${entry.run}`) + '_nirs.snirf')) {
          throw new Error('Invalid recording catalog');
        }
        if (!controller.signal.aborted) setRecordings(catalog.entries);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void loadCatalog();
    return () => controller.abort();
  }, [attempt]);

  let participants = [...new Set(recordings.map((recording) => recording.participant))];
  let selectedParticipant = participants.includes(participant) ? participant : participants[0];
  let available = recordings.filter((recording) => recording.participant === selectedParticipant);
  let selected = available.find((recording) => `${recording.task}:${recording.run ?? ''}` === task) ?? available[0];
  let viewerUrl = selected
    ? `${new URL('index.html', viewerBaseUrl).href}?v=20261118-bridge&mode=viewer&theme=light&dataset=${encodeURIComponent(`data/MULPA_v1.1/${selected.path}`)}`
    : '';

  return (
    <section className="section satori-section" id="viewer" aria-labelledby="satori-heading">
      <div className="section-heading light-heading">
        <div><p className="eyebrow">Satori Viewer · MULPA v1.1</p><h2 id="satori-heading">Explore a recording</h2></div>
        <p>Choose a participant and task to explore their fNIRS recording directly here, with interactive channel views, signals, and events.</p>
      </div>
      {error ? <div className="satori-message" role="alert">
        <p>The recording viewer is currently unavailable.</p>
        <button className="button" type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
      </div> : !selected ? <p className="satori-message" role="status">Loading available recordings…</p> : <div className="satori-card">
        <div className="satori-controls">
          <label><span>Participant</span><select aria-label="Viewer participant" value={selectedParticipant}
            onChange={(event) => setParticipant(event.target.value)}>
            {participants.map((id) => <option key={id} value={id}>{id}</option>)}
          </select></label>
          <label className="satori-task"><span>Task / run</span><select aria-label="Viewer task and run" value={selected.path}
            onChange={(event) => {
              let recording = available.find((entry) => entry.path === event.target.value);
              if (recording) setTask(`${recording.task}:${recording.run ?? ''}`);
            }}>
            {available.map((recording) => <option key={recording.path} value={recording.path}>
              {recordingLabel(recording)}{recording.complete === false ? ' — incomplete' : ''}
            </option>)}
          </select></label>
          <p className="satori-count"><strong>{recordings.length}</strong> recordings<span>{participants.length} participants</span></p>
          <a className="button button-small button-outline" href={viewerUrl} target="_blank" rel="noopener noreferrer">Open in new tab ↗</a>
        </div>
        <RecordingViewer recording={selected} viewerUrl={viewerUrl} />
      </div>}
    </section>
  );
}
