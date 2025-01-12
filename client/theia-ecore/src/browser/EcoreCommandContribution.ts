/********************************************************************************
 * Copyright (c) 2019 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import {
    FrontendApplication,
    open,
    OpenerService,
    QuickOpenItem,
    QuickOpenMode,
    QuickOpenModel,
    QuickOpenOptions,
    QuickOpenService
} from "@theia/core/lib/browser";
import { Command, CommandContribution, CommandRegistry } from "@theia/core/lib/common/command";
import { MessageService } from "@theia/core/lib/common/message-service";
import { ProgressService } from "@theia/core/lib/common/progress-service";
import { SelectionService } from "@theia/core/lib/common/selection-service";
import URI from "@theia/core/lib/common/uri";
import { UriAwareCommandHandler, UriCommandHandler } from "@theia/core/lib/common/uri-command-handler";
import { EDITOR_CONTEXT_MENU } from "@theia/editor/lib/browser";
import { FileDialogService } from "@theia/filesystem/lib/browser";
import { FileStat, FileSystem } from "@theia/filesystem/lib/common/filesystem";
import { NAVIGATOR_CONTEXT_MENU } from "@theia/navigator/lib/browser/navigator-contribution";
import { WorkspaceService } from "@theia/workspace/lib/browser";
import { inject, injectable } from "inversify";

import { FileGenServer } from "../common/generate-protocol";



export const EXAMPLE_NAVIGATOR = [...NAVIGATOR_CONTEXT_MENU, 'example'];
export const EXAMPLE_EDITOR = [...EDITOR_CONTEXT_MENU, 'example'];



export const NEW_ECORE_FILE: Command = {
    id: 'file.newEcoreFile',
    category: 'File',
    label: 'New Ecore-File',
};

@injectable()
export class EcoreCommandContribution implements CommandContribution {

    @inject(FileSystem) protected readonly fileSystem: FileSystem;
    @inject(SelectionService) protected readonly selectionService: SelectionService;
    @inject(OpenerService) protected readonly openerService: OpenerService;
    @inject(FrontendApplication) protected readonly app: FrontendApplication;
    @inject(MessageService) protected readonly messageService: MessageService;
    @inject(FileDialogService) protected readonly fileDialogService: FileDialogService;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(ProgressService) protected readonly progressService: ProgressService;
    @inject(QuickOpenService) protected readonly quickOpenService: QuickOpenService;
    @inject(FileGenServer) private readonly fileGenServer: FileGenServer;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(NEW_ECORE_FILE, this.newWorkspaceRootUriAwareCommandHandler({
            execute: uri => this.getDirectory(uri).then(parent => {
                if (parent) {
                    const parentUri = new URI(parent.uri);

                    const createEcore = (name: string, nsPrefix: string, nsURI: string) => {
                        if (name) {
                            this.fileGenServer.generateEcore(name, nsPrefix, nsURI, parentUri.path.toString()).then(() => {
                                const ecorePath = parentUri.toString() + '/' + name + '.ecore';
                                const fileUriEcore = new URI(ecorePath);
                                open(this.openerService, fileUriEcore);
                            });
                        }
                    };

                    const showInput = (hint: string, prefix: string, onEnter: (result: string) => void) => {
                        const quickOpenModel: QuickOpenModel = {
                            onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
                                const dynamicItems: QuickOpenItem[] = [];
                                const suffix = "Press 'Enter' to confirm or 'Escape' to cancel.";

                                dynamicItems.push(new SingleStringInputOpenItem(
                                    `${prefix}: ${lookFor}. ${suffix}`,
                                    () => onEnter(lookFor),
                                    (mode: QuickOpenMode) => mode === QuickOpenMode.OPEN,
                                    () => false
                                ));

                                acceptor(dynamicItems);
                            }
                        };
                        this.quickOpenService.open(quickOpenModel, this.getOptions(hint, false));
                    };

                    showInput("Name", "Name of Ecore ", (nameOfEcore) => {
                        showInput("Prefix", "Prefix", (prefix) => {
                            showInput("URI", "URI:", (ecore_uri) => {
                                createEcore(nameOfEcore, prefix, ecore_uri);
                            });
                        });
                    });
                }
            })
        }));
    }

    protected withProgress<T>(task: () => Promise<T>): Promise<T> {
        return this.progressService.withProgress('', 'scm', task);
    }

    protected newUriAwareCommandHandler(handler: UriCommandHandler<URI>): UriAwareCommandHandler<URI> {
        return new UriAwareCommandHandler(this.selectionService, handler);
    }

    protected newMultiUriAwareCommandHandler(handler: UriCommandHandler<URI[]>): UriAwareCommandHandler<URI[]> {
        return new UriAwareCommandHandler(this.selectionService, handler, { multi: true });
    }

    protected newWorkspaceRootUriAwareCommandHandler(handler: UriCommandHandler<URI>): WorkspaceRootUriAwareCommandHandler {
        return new WorkspaceRootUriAwareCommandHandler(this.workspaceService, this.selectionService, handler);
    }

    protected async getDirectory(candidate: URI): Promise<FileStat | undefined> {
        const stat = await this.fileSystem.getFileStat(candidate.toString());
        if (stat && stat.isDirectory) {
            return stat;
        }
        return this.getParent(candidate);
    }

    protected getParent(candidate: URI): Promise<FileStat | undefined> {
        return this.fileSystem.getFileStat(candidate.parent.toString());
    }

    private getOptions(placeholder: string, fuzzyMatchLabel: boolean = true, onClose: (canceled: boolean) => void = () => { }): QuickOpenOptions {
        return QuickOpenOptions.resolve({
            placeholder,
            fuzzyMatchLabel,
            fuzzySort: false,
            onClose
        });
    }
}

export class WorkspaceRootUriAwareCommandHandler extends UriAwareCommandHandler<URI> {

    constructor(
        protected readonly workspaceService: WorkspaceService,
        protected readonly selectionService: SelectionService,
        protected readonly handler: UriCommandHandler<URI>
    ) {
        super(selectionService, handler);
    }

    public isEnabled(...args: any[]): boolean {
        return super.isEnabled(...args) && !!this.workspaceService.tryGetRoots().length;
    }

    public isVisible(...args: any[]): boolean {
        return super.isVisible(...args) && !!this.workspaceService.tryGetRoots().length;
    }

    protected getUri(...args: any[]): URI | undefined {
        const uri = super.getUri(...args);
        // If the URI is available, return it immediately.
        if (uri) {
            return uri;
        }
        // Return the first root if available.
        if (!!this.workspaceService.tryGetRoots().length) {
            return new URI(this.workspaceService.tryGetRoots()[0].uri);
        }
        return undefined;
    }
}

class SingleStringInputOpenItem extends QuickOpenItem {

    constructor(
        private readonly label: string,
        private readonly execute: (item: QuickOpenItem) => void = () => { },
        private readonly canRun: (mode: QuickOpenMode) => boolean = mode => mode === QuickOpenMode.OPEN,
        private readonly canClose: (mode: QuickOpenMode) => boolean = mode => true) {

        super();
    }

    getLabel(): string {
        return this.label;
    }

    run(mode: QuickOpenMode): boolean {
        if (!this.canRun(mode)) {
            return false;
        }
        this.execute(this);
        return this.canClose(mode);
    }

}
