import _ from 'lodash';

export const isSubset = (a: any[], b: any[]) =>
  _.differenceWith(a, b, _.isEqual).length === 0;

export const isSubsequence = (a: any[], b: any[]) => {
  const M = a.length;
  const N = b.length;

  let i = 0;

  for (let j = 0; i < M && j < N; ++j) {
    if (_.isEqual(a[i], b[j])) {
      ++i;
    }
  }

  // Did i get incremented for every element of a?
  //   If so, i === M and a is a subsequence of b.
  return i === M;
};

// https://www.geeksforgeeks.org/check-string-substring-another/
// Is "a" a substring of b?
export const isSubstring = (a: any[], b: any[]) => {
  const M = a.length;
  const N = b.length;

  // i iterates over b
  for (let i = 0; i <= N - M; ++i) {
    let j: number;

    // j iterates over a
    for (j = 0; j < M; ++j) {
      if (!_.isEqual(a[j], b[i + j])) {
        break;
      }
    }

    // Did we stop iterating over a because we reached it's end?
    //   If so, a is a substring of b.
    if (j === M) {
      return true;
    }
  }

  return false;
};

// https://www.geeksforgeeks.org/longest-common-substring-dp-29/
export const longestCommonSubstring = (a: any[], b: any[]) => {
  const n = a.length;
  const m = b.length;

  const dp: number[][] = [
    _.range(m + 1).map(() => 0),
    _.range(m + 1).map(() => 0),
  ];
  let res = 0;

  let aEnd: number | null = null;
  let bEnd: number | null = null;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (_.isEqual(a[i - 1], b[j - 1])) {
        dp[i % 2][j] = dp[(i - 1) % 2][j - 1] + 1;

        if (dp[i % 2][j] > res) {
          res = dp[i % 2][j];
          aEnd = i;
          bEnd = j;
        }
      } else {
        dp[i % 2][j] = 0;
      }
    }
  }

  // Keep the TypeScript compiler happy.
  if (aEnd === null || bEnd === null) {
    return null;
  }

  // NOTE: Like array.slice, last number is 1 greater than the index of the last element.
  // > [0,1,2,3].slice(...[1,3])
  // [ 1, 2 ]
  return {
    len: res,
    a: [aEnd - res, aEnd],
    b: [bEnd - res, bEnd],
  };
};
