export type NodeId = 'a1' | 'a2' | 'a3' | 'a4' | 't1' | 't2' | 't3' | 't4';

export type Service = {
  label: string;
  on: NodeId[];
  you: string;
  talo: string;
  back: string;
  stepsTitle?: string;
  steps?: string[];
  downloadLabel?: string;
  downloadFile?: string;
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
    steps: [
      'Discovery call — understand your current BIM software, model structure, standards, and where your coordination workflow slows down or breaks.',
      'Access and audit — Natcha reviews your live model and project documents against what the AI agents need to work reliably.',
      'Fee proposal — based on the audit, the engagement is scoped and priced, with the agents and tools chosen to fit your project, for you to sign off.',
      'Install and configure — the chosen AI agents and software are set up inside your environment, wired into your BIM model.',
      'Test on a live task — the workflow is run against a real piece of your work, so the first results are something your team can actually use.',
      'Review together — you and Natcha walk through the output, catch anything that needs adjusting, and refine the configuration.',
      'Refine and re-test — the setup is tightened until it is reliably producing output you can rely on.',
      'Handover — Natcha continues running it directly for you, or your team takes it over with a short written record of what has been set up.',
      'Ongoing support — optional check-ins if you want the engagement to continue beyond initial setup.',
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
    steps: [
      'Welcome and introductions — goals for the day, quick tour of your current workflow.',
      'Module 1: The orchestrator — how TALO’s AI agents connect to your BIM model and tools.',
      'Module 2: Spec search and model checking — hands-on, using your own project.',
      'Module 3: Calculations and schedules — running the sizing and schedule agents live.',
      'Module 4: Running it independently — your team drives the workflow themselves, Natcha troubleshoots.',
      'Wrap-up, Q&A, and what’s next.',
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

type WheelNode = {
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
