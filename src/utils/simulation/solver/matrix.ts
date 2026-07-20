/**
 * Solves a linear system of equations G * V = I using Gaussian Elimination
 * with partial pivoting.
 *
 * @param G Conductance matrix of size N x N
 * @param I Current/source vector of size N
 * @returns Solution vector V of size N, or null if the system is singular
 */
export function solveLinearSystem(G: number[][], I: number[]): number[] | null {
  const n = I.length
  
  // Create augmented matrix [G | I] to avoid mutating inputs
  const A: number[][] = []
  for (let i = 0; i < n; i++) {
    A.push([...G[i], I[i]])
  }

  for (let i = 0; i < n; i++) {
    // 1. Partial Pivoting: Find the row with the largest absolute value in the current column
    let maxEl = Math.abs(A[i][i])
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i])
        maxRow = k
      }
    }

    // Swap the pivot row with the maximum row
    if (maxRow !== i) {
      const temp = A[maxRow]
      A[maxRow] = A[i]
      A[i] = temp
    }

    // 2. Singular Check: If the pivot is extremely close to zero, the matrix is singular
    if (Math.abs(A[i][i]) < 1e-15) {
      return null
    }

    // 3. Elimination: Make elements below pivot in column i equal to zero
    for (let k = i + 1; k < n; k++) {
      const factor = -A[k][i] / A[i][i]
      for (let j = i; j <= n; j++) {
        if (i === j) {
          A[k][j] = 0 // Exactly zero out the column element
        } else {
          A[k][j] += factor * A[i][j]
        }
      }
    }
  }

  // 4. Back Substitution: Solve for variables from bottom to top
  const V = new Array<number>(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let sum = A[i][n]
    for (let j = i + 1; j < n; j++) {
      sum -= A[i][j] * V[j]
    }
    V[i] = sum / A[i][i]
  }

  return V
}
