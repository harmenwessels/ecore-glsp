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
import { registerDefaultTools, TYPES } from "@glsp/sprotty-client/lib";
import { EcoreGLSPTheiaDiagramServer } from "./ecore-glsp-theia-diagram-server";
import { SelectionService } from "@theia/core";
import { Container, inject, injectable } from "inversify";
import { createEcoreDiagramContainer } from "sprotty-ecore/lib";
import { DiagramConfiguration, TheiaDiagramServer, TheiaSprottySelectionForwarder } from "sprotty-theia/lib";
import { EcoreLanguage } from "../../common/ecore-language";

@injectable()
export class EcoreDiagramConfiguration implements DiagramConfiguration {
    @inject(SelectionService) protected selectionService: SelectionService;
    diagramType: string = EcoreLanguage.DiagramType;

    createContainer(widgetId: string): Container {
        const container = createEcoreDiagramContainer(widgetId);
        container.bind(TYPES.ModelSource).to(EcoreGLSPTheiaDiagramServer).inSingletonScope();
        container.bind(TheiaDiagramServer).toService(EcoreGLSPTheiaDiagramServer);
        // container.rebind(KeyTool).to(TheiaKeyTool).inSingletonScope()
        container.bind(TYPES.IActionHandlerInitializer).to(TheiaSprottySelectionForwarder);
        container.bind(SelectionService).toConstantValue(this.selectionService);

        registerDefaultTools(container);
        return container;
    }
}
