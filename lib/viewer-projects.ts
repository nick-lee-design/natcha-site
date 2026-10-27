// Projects in the TALO Viewer. Each opens the model viewer on its package in public/experiments.
export const PROJECTS = [
  {
    id: 'corridor',
    name: 'Corridor',
    title: 'NCW coordinated corridor',
    text: 'One corridor with its linked architectural and structural models.',
    package: 'ncw-corridor/corridor.json',
    stats: [['Parts', '481'], ['Clashes', '38'], ['Openings', '48']],
  },
  {
    id: 'building',
    name: 'Building',
    title: '3D OVERALL, 19 storeys',
    text: 'The whole MEP model. Large: allow a moment to load.',
    package: 'ncw-building/model.json',
    stats: [['Parts', '21,379'], ['Levels', '28'], ['Clashes', '933'], ['Openings', '1,136']],
  },
] as const;

export type Project = (typeof PROJECTS)[number];
