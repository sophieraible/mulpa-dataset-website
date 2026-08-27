import generatedData from './derived-data.json';

export type TaskKey =
  | 'emotion'
  | 'motorAction'
  | 'motorImagery'
  | 'motorFrequency'
  | 'music1'
  | 'music2'
  | 'rest'
  | 'visual';

export type Participant = {
  id: string;
  age: number;
  sex: 'Female' | 'Male' | 'Missing';
  gender: 'Female' | 'Male' | 'Missing';
  handedness: 'Left' | 'Right' | 'Ambidextrous' | 'Missing';
  headSize: number | null;
  questionnaires: boolean;
  tasks: Record<TaskKey, boolean>;
  physiologyQc: PhysiologyQc;
};

export type PhysiologyQc = {
  runs: number;
  overall: number;
  resp: number;
  hr: number;
  ppg: number;
  ecg: number;
  emg: number;
  gsr: number;
  runDetails: Array<{
    task: string;
    resp: boolean;
    hr: boolean;
    ppg: boolean;
    ecg: boolean;
    emg: boolean;
    gsr: boolean;
  }>;
};

type TaskColumn = { key: TaskKey; short: string; label: string };

// This order follows the eight flags in participant.tsv exactly.
const sourceTaskColumns: TaskColumn[] = [
  { key: 'emotion', short: 'EMO', label: 'Emotion' },
  { key: 'motorAction', short: 'MA', label: 'Motor action' },
  { key: 'motorImagery', short: 'MI', label: 'Motor imagery' },
  { key: 'motorFrequency', short: 'MIFQ', label: 'Motor imagery with frequency change' },
  { key: 'music1', short: 'MUS1', label: 'Music run 1' },
  { key: 'music2', short: 'MUS2', label: 'Music run 2' },
  { key: 'rest', short: 'REST', label: 'Rest' },
  { key: 'visual', short: 'VIS', label: 'Vision' },
];

// The explorer can present the same fields in the dataset-story order.
export const taskColumns: TaskColumn[] = [
  { key: 'rest', short: 'REST', label: 'Rest' },
  { key: 'motorAction', short: 'MA', label: 'Motor action' },
  { key: 'motorImagery', short: 'MI', label: 'Motor imagery' },
  { key: 'motorFrequency', short: 'MIFQ', label: 'Motor imagery with frequency change' },
  { key: 'emotion', short: 'EMO', label: 'Emotion' },
  { key: 'visual', short: 'VIS', label: 'Visual' },
  { key: 'music1', short: 'MUS1', label: 'Music run 1' },
  { key: 'music2', short: 'MUS2', label: 'Music run 2' },
];

const participantTsv = `
sub-01\t23\t1\t1\t2\t56\t1\t11111111
sub-02\t26\t1\t1\t2\t56\t1\t11111111
sub-03\t21\t1\t1\t1\t56\t1\t11111111
sub-04\t27\t1\t1\t1\t56\t1\t11111101
sub-05\t26\t2\t2\t2\t58\t1\t11110111
sub-06\t24\t2\t2\t2\t58\t1\t11110111
sub-07\t25\t1\t1\t2\t58\t1\t11111011
sub-08\t36\t2\t2\t2\t58\t1\t11111111
sub-09\t27\t2\t2\t2\t58\t1\t11111111
sub-10\t30\t1\t1\t2\t58\t1\t11111111
sub-11\t27\t1\t1\t2\t58\t1\t11111111
sub-12\t25\t1\t1\t2\t58\t1\t11111111
sub-13\t24\t1\t1\t2\t58\t1\t11111011
sub-14\t79\t2\t2\t2\t58\t1\t11111111
sub-15\t25\t1\t1\t2\t58\t1\t11110111
sub-16\t21\t1\t1\t2\t58\t1\t11111111
sub-17\t23\t1\t1\t2\t58\t1\t11111111
sub-18\t24\t2\t2\t2\t58\t1\t11111111
sub-19\t24\t1\t1\t2\t58\t1\t11111111
sub-20\t22\t2\t2\t1\t58\t1\t11111111
sub-21\t31\t2\t2\t1\t58\t1\t11111111
sub-22\t22\t1\t1\t2\t58\t1\t11111111
sub-23\t27\t0\t0\t0\t0\t0\t11111011
sub-24\t29\t1\t1\t2\t56\t1\t11111110
sub-25\t22\t1\t1\t2\t56\t1\t11111111
sub-26\t30\t1\t1\t2\t56\t1\t11111111
sub-27\t24\t2\t2\t2\t58\t1\t11111111
sub-28\t33\t2\t2\t2\t58\t1\t11111011
sub-29\t27\t1\t1\t2\t58\t1\t11111111
sub-30\t20\t1\t1\t2\t58\t1\t11111111
sub-31\t25\t1\t1\t2\t58\t1\t11111111
sub-32\t24\t1\t1\t2\t58\t1\t11110111
sub-33\t25\t1\t1\t2\t58\t1\t11111011
sub-34\t24\t2\t2\t2\t56\t1\t11111111
sub-35\t24\t2\t2\t2\t58\t1\t11111111
sub-36\t22\t2\t2\t2\t58\t1\t11110111
sub-37\t24\t2\t2\t2\t58\t1\t11111111
sub-38\t23\t2\t2\t2\t58\t1\t11111111
sub-39\t23\t1\t1\t2\t58\t1\t11111111
sub-40\t22\t2\t2\t1\t58\t1\t11111111
sub-41\t22\t1\t1\t2\t58\t1\t11111111
sub-42\t25\t1\t1\t2\t58\t1\t11111111
sub-43\t28\t1\t1\t2\t58\t1\t11111111
sub-44\t25\t1\t1\t2\t58\t1\t11111111
sub-45\t36\t1\t1\t2\t58\t1\t11111111
sub-46\t28\t0\t0\t0\t0\t0\t11110111
sub-47\t26\t0\t0\t0\t0\t0\t11111111
sub-48\t26\t1\t1\t2\t56\t0\t11111111
sub-49\t23\t1\t1\t2\t58\t1\t01111111
sub-50\t28\t2\t2\t3\t58\t1\t01111111
sub-51\t23\t1\t1\t2\t58\t1\t01111111
sub-52\t23\t1\t1\t2\t58\t1\t11110111
sub-53\t25\t1\t1\t2\t58\t1\t11110011
sub-54\t19\t2\t2\t1\t58\t1\t01111111
sub-55\t31\t0\t0\t0\t0\t0\t01111111
sub-56\t35\t0\t0\t0\t0\t0\t11011111
sub-57\t52\t1\t1\t1\t0\t0\t01110010
`.trim();

function decodeSex(value: string): Participant['sex'] {
  return value === '1' ? 'Female' : value === '2' ? 'Male' : 'Missing';
}

function decodeHandedness(value: string): Participant['handedness'] {
  if (value === '1') return 'Left';
  if (value === '2') return 'Right';
  if (value === '3') return 'Ambidextrous';
  return 'Missing';
}

export const participants: Participant[] = participantTsv.split('\n').map((line) => {
  const [id, age, sex, gender, handedness, headSize, questionnaires, flags] = line.split('\t');
  const taskValues = flags.split('').map((value) => value === '1');

  return {
    id,
    age: Number(age),
    sex: decodeSex(sex),
    gender: decodeSex(gender),
    handedness: decodeHandedness(handedness),
    headSize: headSize === '0' ? null : Number(headSize),
    questionnaires: questionnaires === '1',
    tasks: Object.fromEntries(
      sourceTaskColumns.map((task, index) => [task.key, taskValues[index]]),
    ) as Record<TaskKey, boolean>,
    physiologyQc: generatedData.physiologyQc.find((row) => row.id === id) as PhysiologyQc,
  };
});

export const taskCards = [
  {
    key: 'rest', number: '01', name: 'Rest', count: '56 / 57 complete',
    design: 'REST · 5 minutes · fixation',
    description: 'Eyes-open rest for intrinsic and systemic physiology analyses.', accent: 'lime',
  },
  {
    key: 'motorAction', number: '02', name: 'Motor Action', count: '57 / 57 complete',
    design: 'MA · 9 blocks · 16 s',
    description: 'Bimanual finger tapping with synchronized hand EMG.', accent: 'teal',
  },
  {
    key: 'motorImagery', number: '03', name: 'Motor Imagery', count: '56 / 57 complete',
    design: 'MI · 9 blocks · 16 s',
    description: 'Imagined bilateral upper-limb movement without execution.', accent: 'blue',
  },
  {
    key: 'motorFrequency', number: '04', name: 'Motor Imagery with Frequency Change', count: '57 / 57 complete',
    design: 'MIFQ · 9 blocks · pace reverses at 8 s',
    description: 'Imagined movement accelerates, then gradually decelerates.', accent: 'blue',
  },
  {
    key: 'emotion', number: '05',
    name: 'Emotion',
    count: '51 / 57 complete',
    design: 'EMO · 18 face transitions · 6 s each',
    description: 'Neutral faces transition to happy, sad, or remain neutral.',
    accent: 'coral',
  },
  {
    key: 'visual', number: '06', name: 'Vision', count: '55 / 57 complete',
    design: 'VIS · Threatening · non-threatening · control',
    description: 'Blocked presentation of affective and control images.', accent: 'lime',
  },
  {
    key: 'music', number: '07',
    name: 'Music',
    count: '43 / 57 complete both runs',
    design: 'MUS · Valence × arousal · 7 s excerpts',
    description: 'Positive and negative excerpts at high and low arousal. 2 runs.',
    accent: 'coral',
  },
] as const;

export const physiology = [
  { key: 'ppg', name: 'Pulse waveform', code: 'PPG', kind: 'Peripheral pulse' },
  { key: 'hr', name: 'Heart rate', code: 'HR', kind: 'Cardiac rate' },
  { key: 'spo2', name: 'Oxygen saturation', code: 'SpO₂', kind: 'Blood oxygenation' },
  { key: 'resp', name: 'Respiration', code: 'RESP', kind: 'Breathing cycle' },
  { key: 'ecg', name: 'Electrocardiogram', code: 'ECG', kind: 'Cardiac electrical' },
  { key: 'gsr', name: 'Skin conductance', code: 'GSR', kind: 'Autonomic arousal' },
  { key: 'emg', name: 'Electromyography', code: 'EMG', kind: 'Hand movement' },
  { key: 'temp', name: 'Room temperature', code: 'TEMP', kind: 'Environment' },
] as const;
