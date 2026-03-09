import { Stage } from '../types';

export const formatStageLabel = (stageNumber: number): string =>
  stageNumber === 0 ? 'Prologue' : `Stage ${stageNumber}`;

export const compareStageOrder = (left: Stage, right: Stage): number => {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  return left.stageNumber - right.stageNumber;
};

export const getStageProgressIndex = (
  stages: Stage[],
  currentStage: Stage | null | undefined,
  alreadySorted = false
): number | null => {
  if (!currentStage) {
    return null;
  }

  const orderedStages = alreadySorted ? stages : [...stages].sort(compareStageOrder);
  const currentIndex = orderedStages.findIndex(
    (stage) =>
      stage.stageNumber === currentStage.stageNumber && stage.date === currentStage.date
  );

  return currentIndex === -1 ? null : currentIndex + 1;
};
