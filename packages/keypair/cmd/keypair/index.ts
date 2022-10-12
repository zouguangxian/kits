import * as commander from 'commander'

const command = new commander.Command()
command.name('keypair').description('manage keypairs')

export { command }
