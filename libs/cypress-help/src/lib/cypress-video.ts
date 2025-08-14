import slugify from 'slugify';

export function patchCypressForVideoRecording(cy: any, Cypress: any, speedFactor = 1) {
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////
  // add terminal printing of video timestamps and frame rectangle for further processing by the e2e executor

  if (!Cypress.env('SLOWMOTION') || !Cypress.config('video')) {
    console.log('No videos will be recorded');
    return false;
  } else {
    console.log('Will slow down and add highlights for tutorial video recording');
  }

  let printedFrameRegion = false;

  let globalStartTime = 0;
  const pendingPrints: string[] = [];

  // cy.task cannot be run from the Cypress.on handlers...
  const flushPendingPrints = () => {
    if (!printedFrameRegion) {
      const frameRegion = window.top?.document.querySelector('.screenshot-height-container')?.getBoundingClientRect() ?? null;

      if (frameRegion != null) {
        printedFrameRegion = true;

        if (Cypress.env('SLOWMOTION')) {
          const specName = (Cypress.config() as any).spec.fileName;
          cy.task('log', 'frame:cut:' + specName + ':' + JSON.stringify(frameRegion));
        } else {
          cy.task('log', 'frame:cut:' + JSON.stringify(frameRegion));
        }
      }
    }

    while (pendingPrints.length > 0) {
      const value = pendingPrints.shift();
      console.log('flush', value);
      // for some reason this gets only printed after the current test completes
      // but it is ok anyway
      cy.task('log', value);
    }
  };

  function buildLogStatement(state: 'after' | 'before', scenarioName: string, runOffset: number) {
    let result = 'test:' + state + ':run:' + scenarioName + ':';
    if (Cypress.env('SLOWMOTION')) {
      const specName = (Cypress.config() as any).spec.fileName;
      result += specName + ':';
    }

    result += runOffset;
    return result;
  }

  let currentScenario = '';

  const hackDeleteIndexDb = () => {
    const hackWindow = (cy as any).state('window');
    hackWindow.eval(`
      if (window.indexedDB.databases) {
        window.indexedDB.databases().then(dbs => {
          dbs.forEach(db => { window.indexedDB.deleteDatabase(db.name) });
        });
      }
    `);
  };

  Cypress.on('test:before:run', function () {
    hackDeleteIndexDb();

    const now = Date.now();
    if (globalStartTime === 0) {
      globalStartTime = now;
    }
    currentScenario = slugify(arguments[1].title);
  });

  const beforePrintedScenarios = new Set<string>();

  Cypress.on('window:load' as any, function (win: any) {
    if (win.location.href === 'about:blank') {
      // Do not record the empty page in the beginning
      return;
    }

    if (win.location.href.endsWith('e2e-init-page')) {
      // Do not record the e2e init page on which the app is used to setup app data before the real test
      // This is done to put more focus on the real content of the test in the documentation videos
      return;
    }

    const now = Date.now();

    const runOffset = now - globalStartTime;

    if (currentScenario.length === 0) {
      return;
    }

    const scenario = currentScenario;
    currentScenario = '';

    beforePrintedScenarios.add(scenario);

    console.log('window:load triggered for the first time for', scenario);
    pendingPrints.push(buildLogStatement('before', scenario, runOffset));
  });

  Cypress.on('test:after:run' as any, function () {
    hackDeleteIndexDb();

    const scenario = slugify(arguments[1].title);

    // necessary, as the window:load handler used to trigger the before print does not happen for i.e. ignored features
    // but the after:run handler is still called for them
    if (!beforePrintedScenarios.has(scenario)) {
      return;
    } else {
      beforePrintedScenarios.delete(scenario);
    }

    console.log('test:after:run', arguments);

    if (arguments[1].state === 'passed') {
      const runOffset = Date.now() - globalStartTime;

      pendingPrints.push(buildLogStatement('after', scenario, runOffset));
    }
  });

  ///////////////////////////////////
  // add click/type/should highlights

  const colorClick = 'rgba(255, 50, 50, 0.8)';
  const colorType = 'rgba(50, 255, 50, 0.8)';
  const colorShould = 'rgba(50, 50, 255, 0.8)';

  const waitTime = 400;

  const highlightArea = (rect: any, clr: string, scale: boolean) => {
    const x = Math.round(rect.x);
    const y = Math.round(rect.y);
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    // cy.window() breaks in commands like click due to promise-inside promises stuff
    // this window reference is just there and allows to run synchronous side-effects js without cypress noticing it
    const hackWindow = (cy as any).state('window');
    hackWindow.eval(`
        const time = ${(waitTime * 1.5) / speedFactor};
            
        const x = ${x};
        const y = ${y};
    
        const highlightElement = document.createElement('div');
        highlightElement.style.backgroundColor = '${clr}';
        highlightElement.style.position = 'absolute';
        highlightElement.style.zIndex = '999';
        highlightElement.style['pointer-events'] = 'none';
    
        document.body.appendChild(highlightElement);
    
        const scaleElement = (p) => {
            if (${scale}) {
                const psq = p;
    
                const scale = (0.1 + ((psq < 0.5 ? (1 - psq) : psq)));
    
                const w = scale * ${w};
                const h = scale * ${h};
                
                const wLoss = ${w} - w;
                const hLoss = ${h} - h;
        
                const x = ${x} + wLoss / 2;
                const y = ${y} + hLoss / 2;
        
                return {x, y, w, h};
            } else {
                const w = ${w};
                const h = ${h};
                
                const x = ${x};
                const y = ${y};
        
                return {x, y, w, h};
            }
        };
    
        const newSize = scaleElement(0);
        highlightElement.style.top = newSize.y + 'px';
        highlightElement.style.left = newSize.x + 'px';
        highlightElement.style.width = newSize.w + "px";
        highlightElement.style.height = newSize.h + "px";
          
        const midPoint = ${y + h / 2};
        const isInView = (window.scrollY) <= midPoint && (window.scrollY + window.innerHeight) >= midPoint;
        if (!isInView) {
          window.scrollTo(0, midPoint - window.innerHeight * 0.5);
        }
      
        const tickSize = 15;
    
        let op = 1;
        let prog = 0;
        const fadeIv = setInterval(() => {
            prog += tickSize;
    
            const p = Math.min(1, prog / time);
    
            let op = 1-(p*0.5);
    
            highlightElement.style.opacity = op + '';
    
            const newSize = scaleElement(p);
            highlightElement.style.top = newSize.y + 'px';
            highlightElement.style.left = newSize.x + 'px';
            highlightElement.style.width = newSize.w + "px";
            highlightElement.style.height = newSize.h + "px";
    
        }, tickSize);
    
        setTimeout(() => {
            clearInterval(fadeIv);
            document.body.removeChild(highlightElement);
        }, time);
      `);
  };

  const highlightInteractedElements = (firstParam: any, clr: string, scale: boolean) => {
    if (firstParam != null && firstParam.length != null && firstParam.length > 0 && typeof firstParam !== 'string') {
      for (let i = 0; i < firstParam.length; i++) {
        const elem = firstParam[i];
        if (
          elem != null &&
          typeof elem === 'object' &&
          'getBoundingClientRect' in elem &&
          typeof elem['getBoundingClientRect'] === 'function'
        ) {
          const scrollLocked = (cy as any).state('window').docVideoScrollLock;
          if ('scrollIntoView' in elem && typeof elem['scrollIntoView'] === 'function' && !scrollLocked) {
            elem.scrollIntoView();
          }

          const viewportRect = elem.getBoundingClientRect();
          const viewOwner = elem.ownerDocument;
          const appWindow = viewOwner.defaultView || viewOwner.parentWindow;
          highlightArea(
            {
              x: viewportRect.x + appWindow.scrollX,
              y: viewportRect.y + appWindow.scrollY,
              width: viewportRect.width,
              height: viewportRect.height,
            },
            clr,
            scale
          );
        }
      }
    }
  };

  // To figure out the element that is clicked/typed in need to wait until
  // the selector right before click/type has a subject element
  const waitAndDisplay = (x: any, clr: string) => {
    if (x.state === 'passed') {
      highlightInteractedElements(x.attributes.subject, clr, true);
    } else {
      if (x.attributes.prev.state === 'queued') {
        setTimeout(() => {
          waitAndDisplay(x, clr);
        }, 15);
      } else {
        highlightInteractedElements(x.attributes.prev.attributes.subject, clr, true);
      }
    }
  };

  const cqueue = (cy as any).queue;
  const rc = cqueue.runCommand;

  cqueue.runCommand = function (cmd: any) {
    let delay = 25;

    const supportedCommands: Record<string, string> = {
      click: colorClick,
      type: colorType,
      select: colorClick,
      check: colorClick,
      uncheck: colorClick,
      selectFile: colorClick,
    };

    const markingColor = supportedCommands[cmd.attributes.name];
    if (markingColor != null) {
      waitAndDisplay(cmd, markingColor);
      delay = waitTime;
    }

    flushPendingPrints();

    // This breaks data resets betwen tests somehow. Thus it is important to do that "by hand" in the respective handler above! (test:before:run and after as well)
    // I suspect this specifically only beaks index-db resets by cypress
    return Cypress.Promise.delay(delay / speedFactor)
      .then(() => rc.apply(cqueue, arguments))
      .then(() => Cypress.Promise.delay(delay / speedFactor));
  };

  Cypress.Commands.overwrite('should', function (originalFN: any) {
    const originalParams = [...arguments].slice(1);

    highlightInteractedElements(originalParams[0], colorShould, false);

    return originalFN.apply(originalFN, originalParams);
  });

  return true;
}
