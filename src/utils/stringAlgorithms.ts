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
