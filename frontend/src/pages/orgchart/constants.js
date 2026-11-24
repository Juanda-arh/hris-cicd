export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// Everyone below a person in the live org chart
export function countTeam(node) {
  return node.subordinados.reduce((total, child) => total + 1 + countTeam(child), 0);
}
