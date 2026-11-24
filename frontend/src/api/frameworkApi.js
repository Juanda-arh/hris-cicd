import client from './client';

// The Org Chart framework the admin imported (tabs from Seniority Levels to Scorecard), shared by everyone.
// null: nothing imported, the built-in framework is shown.
export async function getImportedFramework() {
  const { data } = await client.get('/api/marco-organizacional');
  return data;
}

export async function importFramework(fileName, tabs) {
  const { data } = await client.put('/api/marco-organizacional', { nombreArchivo: fileName, pestanas: tabs });
  return data;
}

export async function removeImportedFramework() {
  await client.delete('/api/marco-organizacional');
}
