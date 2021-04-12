export enum TargetMap {
  NYS_RIS = 'nys_ris',
  NPMRDS = 'npmrds'
};

export type ConflationMapId = number
export type TargetMapId = number | string

export enum SelectedDirection {
  Forward,
  Backward,
  Both
}
