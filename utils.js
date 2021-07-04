async function getZkSyncProvider (zksync, networkName) {
  let zkSyncProvider
  try {
    zkSyncProvider = await zksync.getDefaultProvider(networkName)
  } catch (error) {
    console.log('Unable to connect to zkSync.')
    console.log(error)
  }
  return zkSyncProvider
}

async function getEthereumProvider (ethers, networkName) {
  let ethersProvider
  try {
    // eslint-disable-next-line new-cap
    ethersProvider = new ethers.getDefaultProvider(networkName)
  } catch (error) {
    console.log('Could not connect to Rinkeby')
    console.log(error)
  }
  return ethersProvider
}

async function initAccount (rinkebyWallet, zkSyncProvider, zksync) {
  const zkSyncWallet = await zksync.Wallet.fromEthSigner(rinkebyWallet, zkSyncProvider)
  return zkSyncWallet
}

async function registerAccount (wallet) {
  console.log(`Registering the ${wallet.address()} account on zkSync`)
  if (!await wallet.isSigningKeySet()) {
    if (await wallet.getAccountId() === undefined) {
      throw new Error('Unknown account')
    }
    const changePubkey = await wallet.setSigningKey()
    await changePubkey.awaitReceipt()
  }
  console.log(`Account ${wallet.address()} registered`)
}

async function depositToZkSync (zkSyncWallet, token, amountToDeposit, tokenSet) {
  const deposit = await zkSyncWallet.depositToSyncFromEthereum({
    depositTo: zkSyncWallet.address(),
    token: token,
    amount: tokenSet.parseToken(token, amountToDeposit)
  })
  try {
    await deposit.awaitReceipt()
  } catch (error) {
    console.log('Error while awaiting confirmation from the zkSync operators.')
    console.log(error)
  }
}

async function transfer (from, toAddress, amountToTransfer, transferFee, token, zksync, tokenSet) {
  const closestPackableAmount = zksync.utils.closestPackableTransactionAmount(tokenSet.parseToken(token, amountToTransfer))
  const closestPackableFee = zksync.utils.closestPackableTransactionFee(tokenSet.parseToken(token, transferFee))

  const transfer = await from.syncTransfer({
    to: toAddress,
    token: token,
    amount: closestPackableAmount,
    fee: closestPackableFee
  })
  const transferReceipt = await transfer.awaitReceipt()
  console.log('Got transfer receipt.')
  console.log(transferReceipt)
}

// 1. On the next line, replace the last parameter (`ethers`) with `tokenSet`
async function getFee(transactionType, address, token, zkSyncProvider, tokenSet) {
  const fee = await zkSyncProvider.getTransactionFee(transactionType, address, token)

  // 2. On the next line, use the `tokenSet` object instead of `ethers.utils.formatEther`
  return tokenSet.formatToken(token, fee.totalFee)
}

async function withdrawToEthereum (wallet, amountToWithdraw, withdrawalFee, token, zksync, tokenSet) {
  const closestPackableAmount = zksync.utils.closestPackableTransactionAmount(tokenSet.parseToken(token, amountToWithdraw))
  const closestPackableFee = zksync.utils.closestPackableTransactionFee(tokenSet.parseToken(token, withdrawalFee))
  const withdraw = await wallet.withdrawFromSyncToEthereum({
    ethAddress: wallet.address(),
    token: token,
    amount: closestPackableAmount,
    fee: closestPackableFee
  })
  await withdraw.awaitVerifyReceipt()
  console.log('ZKP verification is complete')
}

async function displayZkSyncBalance (wallet, tokenSet) {
  const state = await wallet.getAccountState()
  const commitedBbalances = state.committed.balances
  const verifiedBalances = state.verified.balances
  for (const property in commitedBbalances) {
    console.log(`Commited ${property} balance for ${wallet.address()}: ${tokenSet.formatToken(property, commitedBbalances[property])}`)
  }
  for (const property in verifiedBalances) {
    console.log(`Verified ${property} balance for ${wallet.address()}: ${tokenSet.formatToken(property, verifiedBalances[property])}`)
  }
}

module.exports = {
  getZkSyncProvider,
  getEthereumProvider,
  depositToZkSync,
  registerAccount,
  displayZkSyncBalance,
  transfer,
  withdrawToEthereum,
  getFee,
  initAccount
}
