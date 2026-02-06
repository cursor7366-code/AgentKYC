// Circle Programmable Wallets - Real Escrow Implementation
import crypto from 'crypto'

// Platform config
export const PLATFORM_FEE_PERCENT = 0.15
export const MIN_TASK_BUDGET = 0.20

// Circle API config
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || ''
const CIRCLE_API_BASE = 'https://api.circle.com/v1/w3s'

// Platform escrow wallet (on ETH-SEPOLIA testnet)
export const ESCROW_WALLET = {
  id: '80dc3664-b8c2-50a5-abe2-546730e1c020',
  address: '0xcc499bd7d3b4f819f6f7d7fceaa94049f46b0ddc',
  walletSetId: '6270789e-2579-5fdb-9d48-b8c23497db28',
  blockchain: 'ETH-SEPOLIA'
}

// USDC on Sepolia (Circle's test USDC)
export const USDC_SEPOLIA = {
  address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Circle USDC on Sepolia
  decimals: 6,
  symbol: 'USDC'
}

// Helper to make Circle API calls
async function circleAPI(endpoint: string, method: string = 'GET', body?: object) {
  const url = `${CIRCLE_API_BASE}${endpoint}`
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${CIRCLE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  }
  
  if (body) {
    options.body = JSON.stringify(body)
  }
  
  const response = await fetch(url, options)
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.message || `Circle API error: ${response.status}`)
  }
  
  return data
}

// Generate idempotency key for Circle requests
function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}

// Calculate payment split
export function calculatePayment(totalAmount: number) {
  const platformFee = totalAmount * PLATFORM_FEE_PERCENT
  const agentEarnings = totalAmount - platformFee
  
  return {
    total: totalAmount,
    platformFee: Math.round(platformFee * 100) / 100,
    agentEarnings: Math.round(agentEarnings * 100) / 100
  }
}

// Get escrow wallet balance
export async function getEscrowBalance(): Promise<{ usdc: number; native: number }> {
  try {
    const response = await circleAPI(`/wallets/${ESCROW_WALLET.id}/balances`)
    
    const balances = response.data?.tokenBalances || []
    
    let usdc = 0
    let native = 0
    
    for (const balance of balances) {
      if (balance.token?.symbol === 'USDC') {
        usdc = parseFloat(balance.amount) || 0
      }
      if (balance.token?.symbol === 'ETH' || balance.token?.isNative) {
        native = parseFloat(balance.amount) || 0
      }
    }
    
    return { usdc, native }
  } catch (error) {
    console.error('[Circle] Error getting balance:', error)
    return { usdc: 0, native: 0 }
  }
}

// Check if a deposit has arrived (for a specific task)
export async function checkDeposit(
  taskId: string,
  expectedAmount: number,
  fromAddress?: string
): Promise<{ funded: boolean; txHash?: string; amount?: number }> {
  try {
    // Get recent transactions to the escrow wallet
    const response = await circleAPI(`/transactions?walletIds=${ESCROW_WALLET.id}&state=COMPLETE`)
    
    const transactions = response.data?.transactions || []
    
    // Look for a matching deposit
    // In production, you'd use a memo/reference or create unique deposit addresses
    for (const tx of transactions) {
      if (
        tx.amounts?.[0]?.amount &&
        parseFloat(tx.amounts[0].amount) >= expectedAmount &&
        tx.transactionType === 'INBOUND'
      ) {
        return {
          funded: true,
          txHash: tx.txHash,
          amount: parseFloat(tx.amounts[0].amount)
        }
      }
    }
    
    return { funded: false }
  } catch (error) {
    console.error('[Circle] Error checking deposit:', error)
    return { funded: false }
  }
}

// Create a transfer from escrow to agent wallet
export async function releaseToAgent(
  agentWalletAddress: string,
  amount: number,
  taskId: string
): Promise<{
  success: boolean
  transactionId?: string
  txHash?: string
  error?: string
}> {
  try {
    // Convert amount to USDC smallest unit (6 decimals)
    const amountInSmallestUnit = Math.round(amount * Math.pow(10, USDC_SEPOLIA.decimals))
    
    const transferRequest = {
      idempotencyKey: generateIdempotencyKey(),
      amounts: [amountInSmallestUnit.toString()],
      destinationAddress: agentWalletAddress,
      tokenAddress: USDC_SEPOLIA.address,
      walletId: ESCROW_WALLET.id,
      blockchain: ESCROW_WALLET.blockchain,
      feeLevel: 'MEDIUM',
      // Reference for tracking
      refId: `task_${taskId}`
    }
    
    console.log(`[Circle] Initiating transfer: ${amount} USDC to ${agentWalletAddress}`)
    
    const response = await circleAPI('/developer/transactions/transfer', 'POST', transferRequest)
    
    if (response.data?.id) {
      return {
        success: true,
        transactionId: response.data.id,
        txHash: response.data.txHash
      }
    }
    
    return {
      success: false,
      error: 'Transfer initiated but no transaction ID returned'
    }
  } catch (error) {
    console.error('[Circle] Transfer error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Get transaction status
export async function getTransactionStatus(transactionId: string): Promise<{
  state: string
  txHash?: string
  error?: string
}> {
  try {
    const response = await circleAPI(`/transactions/${transactionId}`)
    
    return {
      state: response.data?.transaction?.state || 'UNKNOWN',
      txHash: response.data?.transaction?.txHash
    }
  } catch (error) {
    return {
      state: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Create a new wallet for an agent (optional - agents can use their own)
export async function createAgentWallet(agentId: string): Promise<{
  success: boolean
  walletId?: string
  address?: string
  error?: string
}> {
  try {
    const response = await circleAPI('/developer/wallets', 'POST', {
      idempotencyKey: generateIdempotencyKey(),
      walletSetId: ESCROW_WALLET.walletSetId,
      blockchains: [ESCROW_WALLET.blockchain],
      count: 1,
      accountType: 'SCA',
      metadata: [{ name: 'agentId', refId: agentId }]
    })
    
    const wallet = response.data?.wallets?.[0]
    
    if (wallet) {
      return {
        success: true,
        walletId: wallet.id,
        address: wallet.address
      }
    }
    
    return { success: false, error: 'No wallet created' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Export escrow wallet address for deposits
export function getEscrowAddress(): string {
  return ESCROW_WALLET.address
}

export default {
  PLATFORM_FEE_PERCENT,
  MIN_TASK_BUDGET,
  ESCROW_WALLET,
  USDC_SEPOLIA,
  calculatePayment,
  getEscrowBalance,
  checkDeposit,
  releaseToAgent,
  getTransactionStatus,
  createAgentWallet,
  getEscrowAddress
}
