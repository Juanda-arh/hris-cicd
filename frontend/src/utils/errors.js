export function getErrorMessage(err) {
  return err.response?.data?.error || 'Could not reach the server. Please try again.';
}