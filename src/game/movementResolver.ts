import type { Point } from '../types';

export interface SlideOptions {
  maxSlideAngleDeg?: number;
  angleStepDeg?: number;
}

export function resolveSlideMovement(
  start: Point,
  attempted: Point,
  bounds: { width: number; height: number },
  canOccupy: (position: Point) => boolean,
  options: SlideOptions = {}
): Point | null {
  const dx = attempted.x - start.x;
  const dy = attempted.y - start.y;
  const distance = Math.hypot(dx, dy);
  console.log(distance)
  if (distance < 0.0001) {
    return null;
  }

  const maxSlideAngleDeg = options.maxSlideAngleDeg ?? 85;
  const angleStepDeg = options.angleStepDeg ?? 5;
  const direction = { x: dx / distance, y: dy / distance };

  for (let angleDeg = angleStepDeg; angleDeg <= maxSlideAngleDeg; angleDeg += angleStepDeg) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const leftCandidate = clampToBounds(
      {
        x: start.x + (direction.x * Math.cos(angleRad) - direction.y * Math.sin(angleRad)) * distance,
        y: start.y + (direction.x * Math.sin(angleRad) + direction.y * Math.cos(angleRad)) * distance
      },
      bounds
    );
    //console.log(leftCandidate)
    if (!isSamePoint(start, leftCandidate) && canOccupy(leftCandidate)) {
      return leftCandidate;
    }

    const rightCandidate = clampToBounds(
      {
        x: start.x + (direction.x * Math.cos(-angleRad) - direction.y * Math.sin(-angleRad)) * distance,
        y: start.y + (direction.x * Math.sin(-angleRad) + direction.y * Math.cos(-angleRad)) * distance
      },
      bounds
    );
    //console.log(rightCandidate)
    if (!isSamePoint(start, rightCandidate) && canOccupy(rightCandidate)) {
      return rightCandidate;
    }
  }

  return null;
}

function clampToBounds(point: Point, bounds: { width: number; height: number }): Point {
  return {
    x: Math.max(0, Math.min(bounds.width, point.x)),
    y: Math.max(0, Math.min(bounds.height, point.y))
  };
}

function isSamePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.0001 && Math.abs(a.y - b.y) < 0.0001;
}
