// One source for the pricing slide and the enquiry form's services list
export type Stage = { id: string; stage: string; scope: string; pricing: string };
export type Package = { id: string; number: number; name: string; formLabel: string; scope: string; fee: string };

export const stagesCaption = 'BIM Coordination & Technical Drawing Production – Project Fee Guidelines';

export const stages: Stage[] = [
  {
    id: 'stage-3',
    stage: 'Stage 3 – Spatial Coordination',
    scope: 'BIM model development, multidisciplinary coordination, clash reviews, coordinated GA drawings and design updates',
    pricing: 'Fixed project fee based on estimated hours and deliverables',
  },
  {
    id: 'stage-4',
    stage: 'Stage 4 – Technical Design',
    scope: 'Detailed BIM coordination, technical drawing production, model updates, detailed drawings, schedules and issue management',
    pricing: 'Fixed project fee based on drawing volume, complexity and coordination requirements',
  },
  {
    id: 'stage-5',
    stage: 'Stage 5 – Manufacturing & Construction',
    scope: 'Construction-stage model updates, drawing revisions, coordination meetings, RFIs and construction support',
    pricing: 'Fixed fee for an agreed programme and scope, with additional services charged separately',
  },
];

export const packages: Package[] = [
  {
    id: 'audit-projects',
    number: 1,
    name: 'Digital asset audit and creation + up to 2 projects',
    formLabel: 'Asset audit + up to 2 projects',
    scope: 'Audit of existing CAD/BIM assets, creation of parametric 3D models for up to 2 projects',
    fee: '£4,000 pcm',
  },
  {
    id: 'revit-support',
    number: 2,
    name: 'Revit support',
    formLabel: 'Revit support',
    scope: 'Modelling / coordination / clash detection / sheets generation / schedule creation',
    fee: '£600 / day',
  },
  {
    id: 'audit',
    number: 3,
    name: 'Digital asset audit and creation',
    formLabel: 'Digital asset audit and creation',
    scope: 'Audit of existing CAD/BIM assets and creation of parametric 3D models',
    fee: '£1,500',
  },
  {
    id: 'bim-management',
    number: 4,
    name: 'BIM management',
    formLabel: 'BIM management',
    scope: 'BIM execution planning / standards and protocols / model audits / coordination management',
    fee: '£800 / day',
  },
];

export const otherService = { id: 'other', formLabel: 'Other / not sure yet' };
