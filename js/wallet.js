import { createAppKit } from '@reown/appkit'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet } from '@reown/appkit/networks'

let modal = null

export function initWallet(projectId) {
    // Accept projectId as parameter, or try to read from Config
    projectId = projectId || window.Config?.REOWN_PROJECT_ID || ''

    if (!projectId) {
        console.warn('Reown project ID not configured')
        return null
    }

    if (modal) {
        return modal  // Already initialized
    }

    const metadata = {
        name: 'Taskman',
        description: 'Stop overthinking. Pick a task. Do it.',
        url: window.location.origin,
        icons: [window.location.origin + '/icons/icon-192.svg']
    }

    modal = createAppKit({
        adapters: [new EthersAdapter()],
        networks: [mainnet],
        metadata,
        projectId,
        features: {
            analytics: false
        }
    })

    // Listen for connection events
    modal.subscribeState(state => {
        if (state.selectedNetworkId && state.address) {
            handleWalletConnected(state.address)
        }
    })

    return modal
}

export function openWalletModal() {
    if (modal) {
        modal.open()
    } else {
        console.error('Wallet modal not initialized')
    }
}

export function getWalletAddress() {
    if (modal) {
        const state = modal.getState()
        return state?.address || null
    }
    return null
}

export function isWalletConnected() {
    if (modal) {
        const state = modal.getState()
        return !!state?.address
    }
    return false
}

export async function disconnectWallet() {
    if (modal) {
        await modal.disconnect()
    }
}

async function handleWalletConnected(address) {
    // This will be called when wallet connects
    // We need to sign a message and verify with our backend
    if (window.handleAppKitWalletConnect) {
        window.handleAppKitWalletConnect(address)
    }
}

export function getModal() {
    return modal
}

// Make available globally for non-module scripts
window.WalletKit = {
    initWallet,
    openWalletModal,
    getWalletAddress,
    isWalletConnected,
    disconnectWallet,
    getModal
}
