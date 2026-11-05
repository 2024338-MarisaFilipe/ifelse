(function () {
  // 1. CANVAS EM FULLSCREEN E WEB AUDIO API
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    background: '#000000',
    display: 'block',
    zIndex: '9999'
  });

  document.body.appendChild(canvas);

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  // Sistema de Áudio (Web Audio API)
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Sons táteis exagerados por desvio de contraste (preto/branco)
  let ultimoSomBraille = 0;
  function emitirSomExagerado(brilho, diferencaContraste, distancia, tipoObjeto) {
    if (!audioCtx || mostrarMorse) return; 
    try {
      const agora = Date.now();
      if (agora - ultimoSomBraille < 12) return;
      ultimoSomBraille = agora;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      let freq, tipoOnda;

      if (tipoObjeto === 1) {
        freq = 60 + (brilho * 2.5) + (diferencaContraste * 3);
        tipoOnda = 'sawtooth';
      } else {
        freq = 150 + (brilho * 3.0) + (diferencaContraste * 3.5);
        tipoOnda = 'square';
      }

      osc.type = tipoOnda; 
      osc.frequency.setValueAtTime(Math.min(freq, 4000), audioCtx.currentTime);

      const volume = Math.min(0.12, 0.03 + (1 - distancia / 30) * 0.09);
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {}
  }

  // Bips senoidais limpos para a página do Código Morse
  function emitirBipMorse(duracao = 0.09, frequencia = 650) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequencia, audioCtx.currentTime);

      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duracao);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duracao);
    } catch (e) {}
  }

  // 2. TRADUÇÃO DE TEXTO PARA CÓDIGO MORSE
  const tabelaMorse = {
    'a': '.-', 'b': '-...', 'c': '-.-.', 'd': '-..', 'e': '.', 'f': '..-.',
    'g': '--.', 'h': '....', 'i': '..', 'j': '.---', 'k': '-.-', 'l': '.-..',
    'm': '--', 'n': '-.', 'o': '---', 'p': '.--.', 'q': '--.-', 'r': '.-.',
    's': '...', 't': '-', 'u': '..-', 'v': '...-', 'w': '.--', 'x': '-..-',
    'y': '-.--', 'z': '--..'
  };

  const fraseTexto = "as bananas sao conspiracoes agarradas a paredes";
  let sequenciaMorse = "";
  for (let char of fraseTexto) {
    if (tabelaMorse[char]) {
      sequenciaMorse += tabelaMorse[char] + " ";
    } else {
      sequenciaMorse += "   ";
    }
  }

  // 3. ESTRUTURA DE DADOS DOS SVGS E MORSE
  let pontosSVG1 = [];
  let pontosSVG2 = [];
  let pontosMorse = [];
  let estadoSVG1 = false; 
  let estadoSVG2 = false;
  let mostrarMorse = false;

  const mouse = { x: -1000, y: -1000 };
  const PASSO = 4;

  const img1 = new Image();
  const img2 = new Image();
  img1.crossOrigin = 'Anonymous';
  img2.crossOrigin = 'Anonymous';

  img1.src = 'objetoarquelogia.svg';
  img2.src = 'objetoarquelogia2.svg';

  let carregados = 0;
  function aoCarregar() {
    carregados++;
    if (carregados === 2) {
      processarTudo();
      gerarPontosMorse();
      requestAnimationFrame(loop);
    }
  }

  img1.onload = aoCarregar;
  img2.onload = aoCarregar;

  function processarTudo() {
    const maxDim = Math.min(width, height) * 0.82;

    let w1 = img1.width || 350;
    let h1 = img1.height || 500;
    if (w1 > h1) {
      h1 = (h1 / w1) * maxDim;
      w1 = maxDim;
    } else {
      w1 = (w1 / h1) * maxDim;
      h1 = maxDim;
    }

    let w2 = img2.width || 350;
    let h2 = img2.height || 500;
    if (w2 > h2) {
      h2 = (h2 / w2) * maxDim;
      w2 = maxDim;
    } else {
      w2 = (w2 / h2) * maxDim;
      h2 = maxDim;
    }

    const espacamento = 140;
    const larguraTotal = w1 + w2 + espacamento;
    const inicioX = (width - larguraTotal) / 2;

    pontosSVG1 = extrairPontos(img1, w1, h1, inicioX, (height - h1) / 2);
    pontosSVG2 = extrairPontos(img2, w2, h2, inicioX + w1 + espacamento, (height - h2) / 2);
  }

  function extrairPontos(img, imgW, imgH, offsetX, offsetY) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    tempCanvas.width = imgW;
    tempCanvas.height = imgH;
    tempCtx.drawImage(img, 0, 0, imgW, imgH);

    const imgData = tempCtx.getImageData(0, 0, imgW, imgH).data;
    const lista = [];

    for (let y = 0; y < imgH; y += PASSO) {
      for (let x = 0; x < imgW; x += PASSO) {
        const index = (Math.floor(y) * Math.floor(imgW) + Math.floor(x)) * 4;
        const r = imgData[index];
        const g = imgData[index + 1];
        const b = imgData[index + 2];
        const alpha = imgData[index + 3];

        if (alpha < 30) continue;

        const brilho = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const contrasteDiferenca = Math.abs(brilho - 128);

        if (brilho > 15) {
          const posX = x + offsetX;
          const posY = y + offsetY;

          const angulo = Math.random() * Math.PI * 2;
          const velocidade = 1.5 + Math.random() * 4;

          lista.push({
            x: posX,
            y: posY,
            origX: posX,
            origY: posY,
            vx: Math.cos(angulo) * velocidade,
            vy: Math.sin(angulo) * velocidade,
            tamanho: 2.2,
            brilho: brilho,
            contraste: contrasteDiferenca,
            cor: `rgb(${brilho}, ${brilho}, ${brilho})`
          });
        }
      }
    }
    return lista;
  }

  function gerarPontosMorse() {
    pontosMorse = [];
    let xPos = width * 0.12;
    let yPos = height * 0.35;

    let index = 0;
    for (let i = 0; i < sequenciaMorse.length; i++) {
      let char = sequenciaMorse[i];
      if (char === '.' || char === '-') {
        pontosMorse.push({
           baseX: xPos,
           baseY: yPos,
           x: Math.random() * width,
           y: Math.random() * height,
           tipo: char,
           tamanho: char === '.' ? 3 : 6,
           offsetSpeed: 0.04 + (index % 3) * 0.01,
           amplitude: 5,
           cor: '#ffffff'
        });
        index++;
      }
      xPos += 20;
      if (xPos > width * 0.88) {
        xPos = width * 0.12;
        yPos += 50;
      }
    }
  }

  // 4. EVENTOS DE INTERAÇÃO (MOUSE, CLIQUE E SCROLL EXCLUSIVO)
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // O clique apenas dispersa parcialmente a areia dos SVGs
  window.addEventListener('click', (e) => {
    initAudio();
    if (e.clientX < width / 2) {
      estadoSVG1 = !estadoSVG1;
    } else {
      estadoSVG2 = !estadoSVG2;
    }
  });

  // O scroll é a única forma de transitar para a página do Morse
  let tempoUltimoScroll = 0;
  window.addEventListener('wheel', (e) => {
    initAudio();
    const agora = Date.now();
    if (agora - tempoUltimoScroll < 350) return; 
    tempoUltimoScroll = agora;

    const estavaNoMorse = mostrarMorse;
    mostrarMorse = !mostrarMorse;

    if (mostrarMorse && !estavaNoMorse) {
      tocarSequenciaMorseAudio();
    }
  }, { passive: true });

  let tocandoMorse = false;
  function tocarSequenciaMorseAudio() {
    if (tocandoMorse) return;
    tocandoMorse = true;

    let delay = 0;
    for (let i = 0; i < sequenciaMorse.length; i++) {
      let char = sequenciaMorse[i];
      if (char === '.') {
        setTimeout(() => emitirBipMorse(0.07, 700), delay);
        delay += 130;
      } else if (char === '-') {
        setTimeout(() => emitirBipMorse(0.22, 700), delay);
        delay += 280;
      } else {
        delay += 140;
      }
    }
    setTimeout(() => { tocandoMorse = false; }, delay + 200);
  }

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    if (carregados === 2) {
      processarTudo();
      gerarPontosMorse();
    }
  });

  let tempoAnimacao = 0;

  // 5. LOOP DE ANIMAÇÃO E RENDERIZAÇÃO
  function loop() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    tempoAnimacao += 0.04;

    if (mostrarMorse) {
      // PÁGINA MORSE: Desenha os pontos animados
      for (let i = 0; i < pontosMorse.length; i++) {
        let pm = pontosMorse[i];
        
        let alvoX = pm.baseX + Math.sin(tempoAnimacao * pm.offsetSpeed + i) * pm.amplitude;
        let alvoY = pm.baseY + Math.cos(tempoAnimacao * pm.offsetSpeed * 0.7 + i) * (pm.amplitude * 0.8);

        pm.x += (alvoX - pm.x) * 0.15;
        pm.y += (alvoY - pm.y) * 0.15;

        ctx.fillStyle = pm.cor;
        ctx.fillRect(Math.round(pm.x), Math.round(pm.y), pm.tamanho, pm.tamanho);
      }
    } else {
      // PÁGINA SVGs: Sem linha circular no meio

      // A. SEGUNDO SVG (Direita - Desintegração Parcial com margem limite)
      for (let i = 0; i < pontosSVG2.length; i++) {
        const p = pontosSVG2[i];
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distMouse = Math.sqrt(dx * dx + dy * dy);

        if (distMouse < 30) {
          const angulo = Math.atan2(dy, dx);
          p.x -= Math.cos(angulo) * 4;
          p.y -= Math.sin(angulo) * 4;

          emitirSomExagerado(p.brilho, p.contraste, distMouse, 2);
        } else {
          if (estadoSVG2) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;

            const deslocamentoX = p.x - p.origX;
            const deslocamentoY = p.y - p.origY;
            const distOrigem = Math.sqrt(deslocamentoX * deslocamentoX + deslocamentoY * deslocamentoY);
            if (distOrigem > 45) {
              p.vx -= deslocamentoX * 0.03;
              p.vy -= deslocamentoY * 0.03;
            }
          } else {
            p.x += (p.origX - p.x) * 0.1;
            p.y += (p.origY - p.y) * 0.1;
          }
        }

        ctx.fillStyle = p.cor;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.tamanho, p.tamanho);
      }

      // B. PRIMEIRO SVG (Esquerda - Desintegração Parcial com margem limite)
      for (let i = 0; i < pontosSVG1.length; i++) {
        const p = pontosSVG1[i];
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distMouse = Math.sqrt(dx * dx + dy * dy);

        if (distMouse < 30) {
          const angulo = Math.atan2(dy, dx);
          p.x -= Math.cos(angulo) * 4;
          p.y -= Math.sin(angulo) * 4;

          emitirSomExagerado(p.brilho, p.contraste, distMouse, 1);
        } else {
          if (estadoSVG1) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;

            const deslocamentoX = p.x - p.origX;
            const deslocamentoY = p.y - p.origY;
            const distOrigem = Math.sqrt(deslocamentoX * deslocamentoX + deslocamentoY * deslocamentoY);
            if (distOrigem > 45) {
              p.vx -= deslocamentoX * 0.03;
              p.vy -= deslocamentoY * 0.03;
            }
          } else {
            p.x += (p.origX - p.x) * 0.1;
            p.y += (p.origY - p.y) * 0.1;
          }
        }

        ctx.fillStyle = p.cor;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.tamanho, p.tamanho);
      }
    }

    requestAnimationFrame(loop);
  }
})();