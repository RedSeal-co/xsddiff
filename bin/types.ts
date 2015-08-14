'use strict';

// ### PrettyDiff
// After makePretty, the raw diff from deep-diff is converted to this.
export interface PrettyDiff {
  kind: string;
  path: string;
  lhs?: any;
  rhs?: any;
  index?: number;
  item?: PrettyDiff;
}

