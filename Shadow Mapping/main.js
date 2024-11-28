let gl;
let canvas;
let matrixStack = [];

let animationRequestId; 
let flag = false; 
let degree = 0.0; 

let prevMouseX = 0;
let prevMouseY = 0;

let currentView = 0; 


let lightPosition = [3.5, 4, 0];
let ambientColor = [0.2, 0.2, 0.2];
let diffuseColor = [0.7, 0.7, 0.7];
let specularColor = [1.0, 1.0, 1.0];

let vMatrix = mat4.create();
let mMatrix = mat4.create();
let pMatrix = mat4.create();

let objVertexPositionBuffer;
let objVertexNormalBuffer;
let objVertexIndexBuffer;

let sphereBuf;
let sphereIndexBuf;
let sphereNormalBuf;

let sphereVertices = [];
let sphereIndicies = [];
let spNormals = [];

let cubeVerts = [];
let cubeIndices = [];
let cubeNormals = [];

let cubeBuf;
let cubeIndexBuf;
let cubeNormalBuf;

let eyePos = [0, 1.4, 4];
let COI = [0.0, 0.0, 0.0];
let viewUp = [0.0, 1.0, 0.0];

let buffersInitialized = false;  
let shadowFramebuffer;

let firstPassShaderProgram;
let secondPassShaderProgram;

let depthTexture;

const depthTextureSize = 4096; 

const depthVertexShaderCode = `#version 300 es
in vec3 aPosition;
uniform mat4 uMMatrix;
uniform mat4 uLVPMatrix;

void main() {
    gl_Position = uLVPMatrix * uMMatrix * vec4(aPosition, 1.0);
}
`;

const depthFragmentShaderCode = `#version 300 es
precision highp float;

out vec4 fragColor;

void main() {
    fragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;

const mainVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uMMatrix;
uniform mat4 uVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uLVPMatrix;

out vec3 posInWorldSpace;
out vec3 vNormal;
out vec4 vShadowCoord;

void main() {
    mat4 modelViewMatrix = uVMatrix * uMMatrix;
    mat4 projectionModelView = uPMatrix * modelViewMatrix;
    gl_Position = projectionModelView * vec4(aPosition, 1.0);

    posInWorldSpace = vec3(uMMatrix * vec4(aPosition, 1.0));
    vNormal = normalize(mat3(uMMatrix) * aNormal);

    vShadowCoord = uLVPMatrix * uMMatrix * vec4(aPosition, 1.0);
}
`;

const mainFragmentShaderCode = `#version 300 es
precision highp float;

in vec3 posInWorldSpace;
in vec3 vNormal;
in vec4 vShadowCoord;

uniform sampler2D uDepthMap;
uniform vec3 uLightPosition;
uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;
uniform vec3 uEyePos;
uniform vec3 uObjectColor;

out vec4 fragColor;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightVector = normalize(uLightPosition - posInWorldSpace);
    vec3 viewVector = normalize(uEyePos - posInWorldSpace);
    vec3 reflectionVector = reflect(-lightVector, normal);

    vec3 diffuse = max(dot(normal, lightVector), 0.0) * uDiffuseColor * uObjectColor;
    vec3 specular = pow(max(dot(viewVector, reflectionVector), 0.0), 25.0) * uSpecularColor;
    vec3 ambient = uAmbientColor * uObjectColor;

    vec3 shadowCoord = vShadowCoord.xyz / vShadowCoord.w;
    shadowCoord = shadowCoord * 0.5 + 0.5;

    float shadow = 1.0;
    float bias = 0.005;

    float depth = texture(uDepthMap, shadowCoord.xy).r;

    if (shadowCoord.z - bias > depth) {
        shadow = 0.5;
    }

    vec3 color = (ambient + shadow * (diffuse + specular));
    fragColor = vec4(color, 1.0);
}
`;

function vertexShaderSetup(vertexShaderCode) {
    const shader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(shader, vertexShaderCode);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert("Vertex Shader Error: " + gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function fragmentShaderSetup(fragShaderCode) {
    const shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, fragShaderCode);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert("Fragment Shader Error: " + gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function createShaderProgram(vertexShaderCode, fragmentShaderCode) {
    const shaderProgram = gl.createProgram();

    const vertexShader = vertexShaderSetup(vertexShaderCode);
    const fragmentShader = fragmentShaderSetup(fragmentShaderCode);

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error("Could not link shader program:", gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

function initShaders() {
    firstPassShaderProgram = createShaderProgram(depthVertexShaderCode, depthFragmentShaderCode);
    secondPassShaderProgram = createShaderProgram(mainVertexShaderCode, mainFragmentShaderCode);
}

function pushMatrix(stack, m) {
    let copy = mat4.create(m); 
    stack.push(copy);
}

function popMatrix(stack) {
    if (stack.length > 0) return stack.pop();
    else {
        console.log("Stack has no matrix to pop!");
        return mat4.create(); 
    }
}

function degToRad(degrees) {
    return (degrees * Math.PI) / 180;
}

function computeNormalMatrix(m) {
    let normalMat = mat3.create();
    mat4.toInverseMat3(m, normalMat); 
    mat3.transpose(normalMat);
    return normalMat;
}

function initDepthFBO() {
    depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.DEPTH_COMPONENT24,
        depthTextureSize,
        depthTextureSize,
        0,
        gl.DEPTH_COMPONENT,
        gl.UNSIGNED_INT,
        null
        );
        
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    FBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, FBO);
    FBO.width = depthTextureSize;
    FBO.height = depthTextureSize;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
    
    const FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (FBOstatus !== gl.FRAMEBUFFER_COMPLETE) {
        console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use FBO");
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function initObject() {
    var request = new XMLHttpRequest();
    request.open("GET", "./texture_and_other_files/teapot.json");
    request.overrideMimeType("application/json");
    request.onreadystatechange = function () {
        if (request.readyState == 4 && request.status == 200) {
            processObject(JSON.parse(request.responseText));
            buffersInitialized = true; 
            drawScene(); 
        }
    };
    request.send();
}

function processObject(objData) {
    if (!objData.vertexPositions || !objData.indices) {
        console.error("Object data is missing vertex positions or indices.");
        return;
    }

    objVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(objData.vertexPositions),
        gl.STATIC_DRAW
    );
    objVertexPositionBuffer.itemSize = 3;
    objVertexPositionBuffer.numItems = objData.vertexPositions.length / 3;

    if (objData.vertexNormals) {
        objVertexNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(objData.vertexNormals),
            gl.STATIC_DRAW
        );
        objVertexNormalBuffer.itemSize = 3;
        objVertexNormalBuffer.numItems = objData.vertexNormals.length / 3;
    } else {
        console.error("Object data is missing vertex normals.");
    }

    objVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(objData.indices),  
        gl.STATIC_DRAW
    );
    objVertexIndexBuffer.itemSize = 1;
    objVertexIndexBuffer.numItems = objData.indices.length;

    buffersInitialized = true;

    drawScene();  
}

function createTeapot(programInfo){
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [-0.3, 0.40, -0.45], mMatrix); 
    mat4.rotate(mMatrix, degToRad(-80), [0, 1, 0], mMatrix); 
    mat4.scale(mMatrix, [0.047, 0.047, 0.047], mMatrix); 

    gl.uniformMatrix4fv(programInfo.uniformLocations.uMMatrix, false, mMatrix);

    let normalMatrix = computeNormalMatrix(mMatrix);
    gl.uniformMatrix3fv(programInfo.uniformLocations.uNMatrix, false, normalMatrix);

    gl.uniform3fv(programInfo.uniformLocations.uObjectColor, [0, 1.0, 0.7]);

    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
    gl.vertexAttribPointer(
        programInfo.attribLocations.aPosition,
        objVertexPositionBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.aPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
    gl.vertexAttribPointer(
        programInfo.attribLocations.aNormal,
        objVertexNormalBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.aNormal);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);

    gl.drawElements(
        gl.TRIANGLES,
        objVertexIndexBuffer.numItems,
        gl.UNSIGNED_SHORT,  
        0
    );

    mMatrix = popMatrix(matrixStack);
}

function initCube() {
    cubeVerts = [
        // Front face
        -1.0, -1.0,  1.0,
            1.0, -1.0,  1.0,
            1.0,  1.0,  1.0,
        -1.0,  1.0,  1.0,

        // Back face
        -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0,  1.0, -1.0,
        -1.0,  1.0, -1.0,

        // Top face
        -1.0,  1.0, -1.0,
            1.0,  1.0, -1.0,
            1.0,  1.0,  1.0,
        -1.0,  1.0,  1.0,

        // Bottom face
        -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0,  1.0,
        -1.0, -1.0,  1.0,

        // Right face
            1.0, -1.0, -1.0,
            1.0,  1.0, -1.0,
            1.0,  1.0,  1.0,
            1.0, -1.0,  1.0,

        // Left face
        -1.0, -1.0, -1.0,
        -1.0,  1.0, -1.0,
        -1.0,  1.0,  1.0,
        -1.0, -1.0,  1.0
    ];

    cubeNormals = [
        // Front face normals
        0.0,  0.0,  1.0,
        0.0,  0.0,  1.0,
        0.0,  0.0,  1.0,
        0.0,  0.0,  1.0,

        // Back face normals
        0.0,  0.0, -1.0,
        0.0,  0.0, -1.0,
        0.0,  0.0, -1.0,
        0.0,  0.0, -1.0,

        // Top face normals
        0.0,  1.0,  0.0,
        0.0,  1.0,  0.0,
        0.0,  1.0,  0.0,
        0.0,  1.0,  0.0,

        // Bottom face normals
        0.0, -1.0,  0.0,
        0.0, -1.0,  0.0,
        0.0, -1.0,  0.0,
        0.0, -1.0,  0.0,

        // Right face normals
        1.0,  0.0,  0.0,
        1.0,  0.0,  0.0,
        1.0,  0.0,  0.0,
        1.0,  0.0,  0.0,

        // Left face normals
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0
    ];

    cubeIndices = [
        0, 1, 2,   0, 2, 3,    // Front
        4, 5, 6,   4, 6, 7,    // Back
        8, 9,10,   8,10,11,    // Top
        12,13,14,  12,14,15,   // Bottom
        16,17,18,  16,18,19,   // Right
        20,21,22,  20,22,23    // Left
    ];
}

function initCubeBuffer() {
    initCube();

    cubeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeVerts), gl.STATIC_DRAW);
    cubeBuf.itemSize = 3;
    cubeBuf.numItems = cubeVerts.length / 3;

    cubeNormalBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeNormals), gl.STATIC_DRAW);
    cubeNormalBuf.itemSize = 3;
    cubeNormalBuf.numItems = cubeNormals.length / 3;

    cubeIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIndices), gl.STATIC_DRAW);
    cubeIndexBuf.itemSize = 1;
    cubeIndexBuf.numItems = cubeIndices.length;
}

function drawCube(programInfo, objectColor) {
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
    gl.vertexAttribPointer(
        programInfo.attribLocations.aPosition,
        cubeBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.aPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
    gl.vertexAttribPointer(
        programInfo.attribLocations.aNormal,
        cubeNormalBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.aNormal);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);

    gl.uniformMatrix4fv(programInfo.uniformLocations.uMMatrix, false, mMatrix);
    
    let normalMatrix = computeNormalMatrix(mMatrix);
    gl.uniformMatrix3fv(programInfo.uniformLocations.uNMatrix, false, normalMatrix);

    gl.uniform3fv(programInfo.uniformLocations.uObjectColor, objectColor);

    gl.drawElements(gl.TRIANGLES, cubeIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

function initSphere(numberslices, numberstacks, radius) {
    sphereVertices = [];
    sphereIndicies = [];
    spNormals = [];

    for (let i = 0; i <= numberslices; i++) {
        let angle = (i * Math.PI) / numberslices;
        let comp1 = Math.sin(angle);
        let comp2 = Math.cos(angle);

        for (let j = 0; j <= numberstacks; j++) {
            let phi = (j * 2 * Math.PI) / numberstacks;
            let comp3 = Math.sin(phi);
            let comp4 = Math.cos(phi);

            let xcood = comp4 * comp1;
            let ycoord = comp2;
            let zcoord = comp3 * comp1;

            sphereVertices.push(radius * xcood, radius * ycoord, radius * zcoord);
            spNormals.push(xcood, ycoord, zcoord);
        }
    }

    for (let i = 0; i < numberslices; i++) {
        for (let j = 0; j < numberstacks; j++) {
            let id1 = i * (numberstacks + 1) + j;
            let id2 = id1 + numberstacks + 1;

            sphereIndicies.push(id1, id2, id1 + 1);
            sphereIndicies.push(id2, id2 + 1, id1 + 1);
        }
    }
}

function initSphereBuffer() {
    const numberslices = 50;
    const numberstacks = 50;
    const radius = 1.0;

    initSphere(numberslices, numberstacks, radius);

    sphereBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereVertices), gl.STATIC_DRAW);
    sphereBuf.itemSize = 3;
    sphereBuf.numItems = sphereVertices.length / 3;

    sphereNormalBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereNormalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
    sphereNormalBuf.itemSize = 3;
    sphereNormalBuf.numItems = spNormals.length / 3;

    sphereIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuf);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(sphereIndicies),
        gl.STATIC_DRAW
    );
    sphereIndexBuf.itemSize = 1;
    sphereIndexBuf.numItems = sphereIndicies.length;
}

function drawSphere(programInfo){
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuf);
    gl.vertexAttribPointer(
        programInfo.attribLocations.aPosition,
        sphereBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.aPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, sphereNormalBuf);
    gl.vertexAttribPointer(
        programInfo.attribLocations.aNormal,
        sphereNormalBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.aNormal);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuf);

    gl.uniformMatrix4fv(programInfo.uniformLocations.uMMatrix, false, mMatrix);
    
    let normalMatrix = computeNormalMatrix(mMatrix);
    gl.uniformMatrix3fv(programInfo.uniformLocations.uNMatrix, false, normalMatrix);

    gl.uniform3fv(programInfo.uniformLocations.uObjectColor, [0,0.6,1.0]);

    gl.drawElements(gl.TRIANGLES, sphereIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

function initGL(canvasElement) {
    try {
        gl = canvasElement.getContext("webgl2");
        if (!gl) {
            gl = canvasElement.getContext("webgl");
        }
        if (!gl) {
            alert("WebGL initialization failed");
            return;
        }
        gl.viewportWidth = canvasElement.width;
        gl.viewportHeight = canvasElement.height;
        gl.enable(gl.DEPTH_TEST);
    } catch (e) {
        console.error("WebGL Initialization Error:", e);
    }
}

function rotateScene() {
    if (flag) {
        degree += 0.42;
    }

    const radius = 2.0; 
    const angleRad = degToRad(degree);
    eyePos[0] = radius * Math.sin(angleRad);
    eyePos[2] = radius * Math.cos(angleRad);

    mat4.lookAt(eyePos, COI, viewUp, vMatrix); 
}

function createBall(programInfo) {
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0.37, 0.20, 0.40], mMatrix); 
    mat4.scale(mMatrix, [0.29, 0.29, 0.29], mMatrix); 
    mat4.rotate(mMatrix, degToRad(40), [1, 0, 0], mMatrix); 
    drawSphere(programInfo);
    mMatrix = popMatrix(matrixStack);
}

function createFloor(programInfo) {
    pushMatrix(matrixStack, mMatrix);

    mat4.translate(mMatrix, [-0.0, -0.12, 0.0], mMatrix); 
    mat4.scale(mMatrix, [1.18, 0.06, 1.3], mMatrix); 

    gl.uniform3fv(programInfo.uniformLocations.uObjectColor, [1.0, 1.0, 0.97]); // Gray table

    drawCube(programInfo, [1.0, 1.0, 0.97]);

    mMatrix = popMatrix(matrixStack);
}

function createObj(programInfo) {
    createBall(programInfo);
    createFloor(programInfo);
    createTeapot(programInfo);
}

function drawScene() {
    if (!buffersInitialized) {
        console.error("Buffers are not initialized yet.");
        return; 
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, FBO);
    gl.viewport(0, 0, depthTextureSize, depthTextureSize);
    gl.clearColor(1.0, 1.0, 1.0, 1.0); 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(firstPassShaderProgram);

    let lightVMatrix = mat4.create();
    let lightPMatrix = mat4.create();
    let lightVPMatrix = mat4.create();

    mat4.lookAt(lightPosition, COI, viewUp, lightVMatrix); 

    mat4.ortho(-10, 10, -10, 10, 1.0, 20.0, lightPMatrix); 
    mat4.multiply(lightPMatrix, lightVMatrix, lightVPMatrix); 

    let firstPassInfo = {
        program: firstPassShaderProgram,
        attribLocations: {
            aPosition: gl.getAttribLocation(firstPassShaderProgram, 'aPosition'),
        },
        uniformLocations: {
            uMMatrix: gl.getUniformLocation(firstPassShaderProgram, 'uMMatrix'),
            uLVPMatrix: gl.getUniformLocation(firstPassShaderProgram, 'uLVPMatrix'),
        },
    };

    gl.uniformMatrix4fv(firstPassInfo.uniformLocations.uLVPMatrix, false, lightVPMatrix);

    gl.clear(gl.DEPTH_BUFFER_BIT);

    createObjDepthPass(firstPassInfo);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(secondPassShaderProgram);

    mat4.identity(mMatrix);

    mat4.identity(vMatrix);
    mat4.lookAt(eyePos, COI, viewUp, vMatrix); 

    rotateScene();

    mat4.identity(pMatrix);
    mat4.perspective(degToRad(2900), canvas.width / canvas.height, 0.1, 1000, pMatrix); 

    let secondPassInfo = {
        program: secondPassShaderProgram,
        attribLocations: {
            aPosition: gl.getAttribLocation(secondPassShaderProgram, 'aPosition'),
            aNormal: gl.getAttribLocation(secondPassShaderProgram, 'aNormal'),
        },
        uniformLocations: {
            uMMatrix: gl.getUniformLocation(secondPassShaderProgram, 'uMMatrix'),
            uVMatrix: gl.getUniformLocation(secondPassShaderProgram, 'uVMatrix'),
            uPMatrix: gl.getUniformLocation(secondPassShaderProgram, 'uPMatrix'),
            uNMatrix: gl.getUniformLocation(secondPassShaderProgram, 'uNMatrix'),
            uLVPMatrix: gl.getUniformLocation(secondPassShaderProgram, 'uLVPMatrix'),
            uLightPosition: gl.getUniformLocation(secondPassShaderProgram, 'uLightPosition'),
            uAmbientColor: gl.getUniformLocation(secondPassShaderProgram, 'uAmbientColor'),
            uDiffuseColor: gl.getUniformLocation(secondPassShaderProgram, 'uDiffuseColor'),
            uSpecularColor: gl.getUniformLocation(secondPassShaderProgram, 'uSpecularColor'),
            uEyePos: gl.getUniformLocation(secondPassShaderProgram, 'uEyePos'),
            uObjectColor: gl.getUniformLocation(secondPassShaderProgram, 'uObjectColor'),
            uDepthMap: gl.getUniformLocation(secondPassShaderProgram, 'uDepthMap'),
        },
    };

    gl.uniformMatrix4fv(secondPassInfo.uniformLocations.uPMatrix, false, pMatrix);
    gl.uniformMatrix4fv(secondPassInfo.uniformLocations.uVMatrix, false, vMatrix);
    gl.uniformMatrix4fv(secondPassInfo.uniformLocations.uLVPMatrix, false, lightVPMatrix);

    gl.uniform3fv(secondPassInfo.uniformLocations.uLightPosition, lightPosition);
    gl.uniform3fv(secondPassInfo.uniformLocations.uAmbientColor, ambientColor);
    gl.uniform3fv(secondPassInfo.uniformLocations.uDiffuseColor, diffuseColor);
    gl.uniform3fv(secondPassInfo.uniformLocations.uSpecularColor, specularColor);
    gl.uniform3fv(secondPassInfo.uniformLocations.uEyePos, eyePos);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.uniform1i(secondPassInfo.uniformLocations.uDepthMap, 0);

    createObj(secondPassInfo);

    if (flag) {
        animationRequestId = requestAnimationFrame(drawScene);
    }
}

function createObjDepthPass(programInfo){
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [-0.5, 0.19, -0.8], mMatrix); 
    mat4.rotate(mMatrix, degToRad(-80), [0, 1, 0], mMatrix); 
    mat4.scale(mMatrix, [0.05, 0.05, 0.05], mMatrix); 

    gl.uniformMatrix4fv(programInfo.uniformLocations.uMMatrix, false, mMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
    gl.vertexAttribPointer(
        programInfo.attribLocations.aPosition,
        objVertexPositionBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.aPosition);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);

    gl.drawElements(
        gl.TRIANGLES,
        objVertexIndexBuffer.numItems,
        gl.UNSIGNED_SHORT,  
        0
    );

    mMatrix = popMatrix(matrixStack);

    createBall(programInfo);
}

function onMouseDown(event) {
    if (!canvas) {
        console.error("Canvas is not defined");
        return;
    }

    var canvasWidth = canvas.width;  
    var canvasHeight = canvas.height;
    document.addEventListener("mousemove", onMouseMove, false);
    document.addEventListener("mouseup", onMouseUp, false);
    document.addEventListener("mouseout", onMouseOut, false);

    if (
        event.layerX <= canvasWidth &&
        event.layerX >= 0 &&
        event.layerY <= canvasHeight &&
        event.layerY >= 0
    ) {
        prevMouseX = event.clientX;
        prevMouseY = canvas.height - event.clientY;
    }
}

function onMouseMove(event) {
    if (!canvas) {
        console.error("Canvas is not defined");
        return;
    }

    if (
        event.layerX <= canvas.width &&
        event.layerX >= 0 &&
        event.layerY <= canvas.height &&
        event.layerY >= 0
    ) {
        var mouseX = event.clientX;
        var diffX = mouseX - prevMouseX;
        degree = degree + diffX / 5;
        prevMouseX = mouseX;

        var mouseY = canvas.height - event.clientY;
        var diffY = mouseY - prevMouseY;
        prevMouseY = mouseY;

        drawScene();
    }
}

function onMouseUp(event) {
    document.removeEventListener("mousemove", onMouseMove, false);
    document.removeEventListener("mouseup", onMouseUp, false);
    document.removeEventListener("mouseout", onMouseOut, false);
}

function onMouseOut(event) {
    document.removeEventListener("mousemove", onMouseMove, false);
    document.removeEventListener("mouseup", onMouseUp, false);
    document.removeEventListener("mouseout", onMouseOut, false);
}

function webGLStart() {
    const canvasElement = document.getElementById("Assignment4");
    if (!canvasElement) {
        console.error("Canvas element not found!");
        return;
    }

    canvas = canvasElement; 

    document.addEventListener("mousedown", onMouseDown, false);

    const animateChk = document.getElementById('animateChk');
    if (animateChk) {
        animateChk.addEventListener('change', (event) => {
            flag = event.target.checked;
            if (flag) {
                drawScene();
            } else {
                if (animationRequestId) {
                    cancelAnimationFrame(animationRequestId);
                }
            }
        });
    } else {
        console.error("Animate Checkbox not found!");
    }

    const zLight = document.getElementById('zLight');
    if (zLight) {
        zLight.addEventListener('input', (event) => {
            lightPosition[2] = parseFloat(event.target.value);
            drawScene();
        });
    } else {
        console.error("Light X Slider not found!");
    }

    initGL(canvasElement); 
    initShaders(); 

    initSphereBuffer();
    initCubeBuffer();
    initObject();
    initDepthFBO();
    drawScene(); 
}  
