/**
 * Sign a message with a Turnkey Solana address.
 * @param signer
 * @param fromAddress
 * @param message
 */
export async function signMessage(input)  {
  const { signer, fromAddress, message } = input;
  const messageAsUint8Array = Buffer.from(message);

  const signature = await signer.signMessage(messageAsUint8Array, fromAddress);

  return signature;
}