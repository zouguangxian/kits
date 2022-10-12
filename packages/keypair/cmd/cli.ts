#!/usr/bin/env -S npx ts-node
import * as commander from 'commander'
import * as glob from 'glob'
import * as path from 'path'

interface ModuleInfo {
    filename: string
    dirname: string
    relative: string
    module: any
}

function listFiles(root: string, pattern: string): string[] {
    return glob.sync(pattern, {
        cwd: root,
        nosort: true,
    })
}

async function importModules(root: string, files: string[]): Promise<ModuleInfo[]> {
    return Promise.all(
        files.map(async (file) => {
            const filename = path.normalize(path.join(root, file))
            const relative = path.relative(root, filename)
            const dirname = path.dirname(relative)
            const module = await import(filename)
            return { filename, dirname, relative, module }
        }),
    )
}

function getFullPathOfCommand(command: commander.Command) {
    let parts: string[] = []
    let current: commander.Command | null = command
    while (current !== undefined && current !== null) {
        parts.push(current.name())
        current = current.parent
    }
    return parts.reverse().join('/')
}

function findCommand(parent: commander.Command, name: string): commander.Command | undefined {
    return parent.commands.find((cmd) => {
        cmd.name() === name || cmd.aliases().includes(name)
    })
}

function buildCommandFamily(commands: ModuleInfo[], family: Record<string, ModuleInfo>) {
    for (const moduleInfo of commands) {
        const { filename, dirname, relative, module } = moduleInfo
        const { command } = module
        if (command === undefined) {
            throw new Error(`${filename} does not contain valid command`)
        }

        const modulePath = relative.endsWith('index.ts') ? dirname : relative
        family[modulePath] = moduleInfo

        if (modulePath === '.') {
            continue
        }

        const parentModule = path.dirname(modulePath)
        const parentCommandInfo = family[parentModule]
        const parent = parentCommandInfo.module.command
        const child = findCommand(parent, command.name())
        if (child !== undefined) {
            const childCommandInfo = Object.values(family).filter(
                (item: ModuleInfo) => item.module.command === child,
            )[0]

            throw new Error(`${filename} has duplicate command, previous is ${childCommandInfo.filename}`)
        }
        parent.addCommand(command)
    }
    return family
}

async function main() {
    const root = __dirname

    let family: Record<string, ModuleInfo> = {}
    let commandNames = new Set<string>()

    {
        const files = listFiles(root, '**/index.ts')
        const moduleInfos = await importModules(root, files)
        buildCommandFamily(moduleInfos, family)
    }

    {
        const files = listFiles(root, '**/*.cmd.ts')
        const moduleInfos = await importModules(root, files)
        buildCommandFamily(moduleInfos, family)
    }

    const rootCommand = family['.'].module.command
    rootCommand.parse(process.argv)
}

main()
