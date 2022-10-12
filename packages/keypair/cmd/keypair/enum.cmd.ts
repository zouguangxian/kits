import * as commander from 'commander'
import * as fs from 'fs'
// @ts-ignore
import expandTilde from 'expand-tilde'
import * as aptos from 'aptos'
import * as bip39 from 'bip39'
import { bytesToHex } from '@noble/hashes/utils'
import * as ethers from 'ethers'

const command = new commander.Command()
command
    .name('enum')
    .option('--file <file>', 'the filename the keypair file, which contains mnemonic')
    .option('--mnemonic <mnemonic>', 'the mnemonic')
    .requiredOption('--coin-type [44|637]', 'the coin type of mnemonic, refer to BIP44')
    .requiredOption('--account-index <[0-9]>', 'the account of mnemonic, refer to BIP44')
    .requiredOption('--address-index <[0-9]>', 'the address index of mnemonic, refer to BIP44')
    .action(async (options, command) => {
        console.log('options', command.optsWithGlobals())
        verify(command.optsWithGlobals())
    })

function parseRange(value: string) {
    const rangePattern = /^(?<from>[0-9]+)-(?<to>[0-9]+)$/
    const match = value.match(rangePattern)
    if (!match) {
        const m = value.match(/^[0-9]+$/)
        return { from: parseInt(m![0]), to: parseInt(m![0]) }
    }
    return match ? { from: parseInt(match.groups!.from), to: parseInt(match.groups!.to) } : null
}

function verify(options: any) {
    const coinType = parseInt(options.coinType)
    const accountIndex = options.accountIndex
    const addressIndex = options.addressIndex

    let mnemonic
    if (options.file) {
        const filename = expandTilde(options.file)
        const object = JSON.parse(fs.readFileSync(filename, 'utf8'))
        mnemonic = object.mnemonic
    } else if (options.mnemonic) {
        mnemonic = options.mnemonic
    } else {
        throw new Error('Either --file or --mnemonic is required')
    }

    const normalizeMnemonics = mnemonic
        .trim()
        .split(/\s+/)
        .map((part: string) => part.toLowerCase())
        .join(' ')

    //https://aptos.dev/guides/building-your-own-wallet/#creating-an-aptos-account

    const accountIndexRange = parseRange(accountIndex)
    const addressIndexRange = parseRange(addressIndex)
    if (!accountIndexRange || !addressIndexRange) {
        throw new Error('Invalid account index or address index')
    }

    for (let accountIndex = accountIndexRange.from; accountIndex <= accountIndexRange.to; accountIndex++) {
        for (let addressIndex = addressIndexRange.from; addressIndex <= addressIndexRange.to; addressIndex++) {

            let pathLevel: string
            let address: string
            switch (coinType) {
                case 60: {
                    pathLevel = `m/44'/${coinType}'/${accountIndex}'/0/${addressIndex}`
                    const wallet = ethers.ethers.Wallet.fromMnemonic(normalizeMnemonics, pathLevel)
                    address = wallet.address
                    break
                }
                case 637: {
                    pathLevel = `m/44'/${coinType}'/${accountIndex}'/0'/${addressIndex}'`
                    if (!aptos.AptosAccount.isValidPath(pathLevel)) {
                        throw new Error('Invalid path')
                    }
                    const { key } = aptos.derivePath(pathLevel, bytesToHex(bip39.mnemonicToSeedSync(normalizeMnemonics)))
                    const account = new aptos.AptosAccount(new Uint8Array(key))
                    address = account.address().toString()
                    break
                }
                default:
                    throw new Error(`Invalid coin type: ${coinType}`)
            }

            console.log(`path: ${pathLevel}, address: ${address}`)
        }
    }
}

export { command }
