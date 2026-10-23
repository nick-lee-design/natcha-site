export type NodeId = 'a1' | 'a2' | 'a3' | 'a4' | 't1' | 't2' | 't3' | 't4';

export type Step = {
  title: string;
  body: string;
  tag?: string;
  who?: string;
  get?: string;
  optional?: boolean;
};

export type Phase = { name: string; count: number; loop?: string };

export type Service = {
  label: string;
  on: NodeId[];
  you: string;
  talo: string;
  back: string;
  stepsTitle?: string;
  phases?: Phase[];
  steps?: Step[];
  // Which step adds each of the nine parts of the isometric figure (plan, columns,
  // frame, ductwork, pipework, valve, hangers, dimensions, monitoring unit).
  // Without it the parts spread evenly across the steps.
  build?: number[];
  downloadLabel?: string;
  downloadFile?: string;
  // Its steps stay open in their own section below the list, whichever service is selected
  pinned?: boolean;
};

export const services: Service[] = [
  {
    label: '3D modelling, coordination and clash resolution',
    on: ['a1', 't1'],
    you: 'Describe the space and the design intent.',
    talo: 'Directs the modelling agent to build and update the 3D model, coordinating disciplines and resolving clashes, in your modelling software.',
    back: 'An updated 3D model, ready for you to review.',
  },
  {
    label: 'AI tools implementation',
    on: ['a2', 't2', 't3'],
    you: 'Share how your team works today.',
    talo: 'Has the implementation agent configure the right AI agents and tools on your automation platform, wired into your BIM model.',
    back: 'A working AI tools implementation, tuned to your project.',
    stepsTitle: 'How TALO Engine implements AI tools into your organisation',
    phases: [
      { name: 'Scope', count: 3 },
      { name: 'Build', count: 2 },
      { name: 'Refine', count: 2, loop: 'until reliable' },
      { name: 'Hand over', count: 2 },
    ],
    steps: [
      { title: 'Discovery call', body: 'Understand your current BIM software, model structure, standards, and where your coordination workflow slows down or breaks.', who: 'You and Natcha', get: 'A map of where your workflow breaks' },
      { title: 'Access and audit', body: 'Natcha reviews your live model and project documents against what the AI agents need to work reliably.', who: 'Natcha', get: 'What your model needs before the agents go in' },
      { title: 'Fee proposal', body: 'Based on the audit, the engagement is scoped and priced, with the agents and tools chosen to fit your project, for you to sign off.', who: 'Natcha, then your sign-off', get: 'A scoped, priced proposal' },
      { title: 'Install and configure', body: 'The chosen AI agents and software are set up inside your environment, wired into your BIM model.', who: 'Natcha', get: 'AI agents running in your environment' },
      { title: 'Test on a live task', body: 'The workflow is run against a real piece of your work, so the first results are something your team can actually use.', who: 'Natcha, on your work', get: 'First results your team can use' },
      { title: 'Review together', body: 'You and Natcha walk through the output, catch anything that needs adjusting, and refine the configuration.', who: 'You and Natcha', get: 'Agreed adjustments' },
      { title: 'Refine and re-test', body: 'The setup is tightened until it is reliably producing output you can rely on.', who: 'Natcha', get: 'Output you can rely on' },
      { title: 'Handover', body: 'Natcha continues running it directly for you, or your team takes it over with a short written record of what has been set up.', who: 'Natcha or your team', get: 'A short written record of the setup' },
      { title: 'Ongoing support', body: 'Optional check-ins if you want the engagement to continue beyond initial setup.', who: 'You and Natcha', get: 'Check-ins beyond initial setup', optional: true },
    ],
  },
  {
    label: 'Design management support',
    on: ['a3', 't3'],
    you: 'Say which rules and standards apply.',
    talo: 'Runs the coordination agent to check the BIM model against your design management rules.',
    back: 'A clear list of issues and decisions, ready for you to review.',
  },
  {
    label: 'Corporate training programme',
    on: ['a4', 't3', 't4'],
    you: 'Say which skills and workflows to cover.',
    talo: 'Directs the training agent to build a programme from the BIM model, with materials tailored to your team.',
    back: 'A training programme ready to roll out to your team.',
    stepsTitle: 'A full day with TALO Engine',
    pinned: true,
    // Welcome: plan. Orchestrator: columns and frame. Spec search: ductwork. Calculations: pipework and valve. Running it: hangers and monitoring. Wrap-up: dimensions.
    build: [0, 1, 1, 2, 3, 3, 4, 5, 4],
    phases: [
      { name: 'Open', count: 1 },
      { name: 'Modules', count: 4 },
      { name: 'Close', count: 1 },
    ],
    steps: [
      { title: 'Welcome and introductions', body: 'Goals for the day, quick tour of your current workflow.' },
      { title: 'The orchestrator', tag: 'Module 1', body: 'How TALO’s AI agents connect to your BIM model and tools.' },
      { title: 'Spec search and model checking', tag: 'Module 2', body: 'Hands-on, using your own project.' },
      { title: 'Calculations and schedules', tag: 'Module 3', body: 'Running the sizing and schedule agents live.' },
      { title: 'Running it independently', tag: 'Module 4', body: 'Your team drives the workflow themselves, Natcha troubleshoots.' },
      { title: 'Wrap-up', body: 'Q&A, and what’s next.' },
    ],
    downloadLabel: 'Download Full Day programme',
    downloadFile: 'Corporate-Training-Programme.pdf',
  },
  {
    label: 'University training programme',
    on: ['a4', 't3', 't4'],
    you: 'Say which course, year group and learning outcomes it should support.',
    talo: 'Directs the training agent to build a programme from real project data, adapted for a university setting.',
    back: 'A university training programme, ready to teach from.',
  },
];

export type WheelNode = {
  id: NodeId;
  kind: 'agent' | 'tool';
  spoke: [number, number, number, number];
  at: [number, number];
  label: [string, string];
  labelX: number;
  labelY: number;
};

// Positions in the 640 x 640 wheel. Agents are circles, tools are squares.
export const wheelNodes: WheelNode[] = [
  { id: 'a1', kind: 'agent', spoke: [320, 142, 320, 192], at: [320, 115], label: ['Modelling', 'agent'], labelX: 320, labelY: 56 },
  { id: 't1', kind: 'tool', spoke: [445.2, 194.8, 410.5, 229.5], at: [443, 153], label: ['Modelling', 'software'], labelX: 465, labelY: 219 },
  { id: 'a2', kind: 'agent', spoke: [497, 320, 448, 320], at: [525, 320], label: ['Implementation', 'agent'], labelX: 525, labelY: 364 },
  { id: 't2', kind: 'tool', spoke: [445.2, 445.2, 410.5, 410.5], at: [443, 443], label: ['Automation', 'platform'], labelX: 465, labelY: 509 },
  { id: 'a3', kind: 'agent', spoke: [320, 497, 320, 448], at: [320, 525], label: ['Coordination', 'agent'], labelX: 320, labelY: 569 },
  { id: 't3', kind: 'tool', spoke: [194.8, 445.2, 229.5, 410.5], at: [153, 443], label: ['BIM', 'model'], labelX: 175, labelY: 509 },
  { id: 'a4', kind: 'agent', spoke: [143, 320, 192, 320], at: [115, 320], label: ['Training', 'agent'], labelX: 115, labelY: 364 },
  { id: 't4', kind: 'tool', spoke: [194.8, 194.8, 229.5, 229.5], at: [153, 153], label: ['Training', 'materials'], labelX: 175, labelY: 219 },
];
