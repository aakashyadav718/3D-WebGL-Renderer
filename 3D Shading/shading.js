var gl;
var canvas;

var matrixStack = [];

var buf;
var indexBuf;
var cubeNormalBuf;
var spBuf;
var spIndexBuf;
var spNormalBuf;

var spVerts = [];
var spIndicies = [];
var spNormals = [];

var aPositionLocation;
var aNormalLocation;
var uPMatrixLocation;
var uMMatrixLocation;
var uVMatrixLocation;
var normalMatrixLocation;

var degree0 = 0.0;
var degree1 = 0.0;
var degree2 = 0.0;
var degree3 = 0.0;
var degree4 = 0.0;
var degree5 = 0.0;
var prevMouseX = 0.0;
var prevMouseY = 0.0;

var scene = 0;

// initialize model, view, and projection matrices
var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix
var uNormalMatrix = mat3.create(); // normal matrix

// var lightPosition = [5.8, 5.5, 4];
var lightPosition = [5.8, 5.5, 4];
var ambientColor = [1, 1, 1];
var diffuseColor = [1.0, 1.0, 1.0];
var specularColor = [1.0, 1.0, 1.0];

var eyePos = [0.0, 0.0, 2.0];
var COI = [0.0, 0.0, 0.0];
var viewUp = [0.0, 1.0, 0.0];

// Flat Shading -> Vertex shader code
const flatVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

out mat4 viewMatrix;
out vec3 posInEyeSpace;

void main() {
    mat4 MVP;
    MVP = uPMatrix * uVMatrix * uMMatrix;
    gl_Position = MVP * vec4(aPosition, 1.0);
    viewMatrix = uVMatrix;
    posInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition, 1.0)).xyz;
}`;

// Fragment shader code

const flatFragShaderCode = `#version 300 es
precision mediump float;
in vec3 posInEyeSpace;
uniform vec3 uLightPosition;
uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;
in mat4 viewMatrix;

out vec4 fragColor;

void main() {
    vec3 normal = normalize(cross(dFdx(posInEyeSpace), dFdy(posInEyeSpace)));

    vec3 lightVec = normalize(uLightPosition - posInEyeSpace);

    vec3 refVec = normalize(-reflect(lightVec, normal));

    vec3 viewVec = normalize(-posInEyeSpace);

    float ambient = 0.20;
    float diffuse = max(dot(lightVec, normal), 0.0);
    float specular = pow(max(dot(refVec, viewVec), 0.0), 35.0);

    vec3 light_color = uAmbientColor * ambient + uDiffuseColor * diffuse + uSpecularColor * specular;
    
    fragColor = vec4(light_color, 1.0);
}`;

// Gouraud Shading -> Vertex shader code

const perVertVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

out vec3 fColor;

uniform vec3 uLightPosition;
uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;

void main() {

    vec3 normalInEyeSpace = normalize((transpose(inverse(mat3(uVMatrix * uMMatrix)))) * aNormal);
    vec3 posEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition, 1.0)).xyz;

    vec3 lightVec = normalize(uLightPosition - posEyeSpace);
    vec3 refVec = normalize(-reflect(lightVec, normalInEyeSpace));
    vec3 viewVec = normalize(-posEyeSpace);

    float diffuse = max(dot(normalInEyeSpace, lightVec), 0.0);
    float specular = pow(max(dot(refVec, viewVec), 0.0), 35.0);
    float ambient = 0.15;
    fColor = uAmbientColor * ambient + uDiffuseColor * diffuse + uSpecularColor * specular;

    gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aPosition, 1.0);
}`;

// Fragment shader code

const perVertFragShaderCode = `#version 300 es
precision mediump float;
in vec3 fColor;
out vec4 fragColor;

void main() {
    fragColor = vec4(fColor, 1.0);
}`;

// Phong Shading -> Vertex shader code

const perFragVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

out vec3 posInEyeSpace;
out vec3 normalInEyeSpace;

out vec3 L;
out vec3 V;

uniform vec3 uLightPosition;

void main() {
    posInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition, 1.0)).xyz;
    normalInEyeSpace = normalize((transpose(inverse(mat3(uVMatrix * uMMatrix)))) * aNormal);

    L = normalize(uLightPosition - posInEyeSpace);

    V = normalize(-posInEyeSpace);

    gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aPosition, 1.0);
}`;

// Fragment shader code

const perFragFragShaderCode = `#version 300 es
precision mediump float;
out vec4 fragColor;

in vec3 normalInEyeSpace;
in vec3 L;
in vec3 V;
in vec3 posInEyeSpace;

uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;

void main() {

    vec3 normal = normalInEyeSpace
;
    vec3 lightVec = L;
    vec3 viewVec = V;

    vec3 refVec = normalize(-reflect(lightVec, normal));

    float diffuse = max(dot(normal, lightVec), 0.0);
    float specular = pow(max(dot(refVec, viewVec), 0.0), 35.0);
    float ambient = 0.15;
    vec3 fColor = uAmbientColor * ambient + uDiffuseColor * diffuse + uSpecularColor * specular;
    fragColor = vec4(fColor, 1.0);
}`;

function initGL(canvas) {
    try {
        gl = canvas.getContext("webgl2");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {}
    if (!gl) {
        alert("WebGL initialization failed");
    }
}

function vertexShaderSetup(vertexShaderCode) {
    shader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(shader, vertexShaderCode);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
        alert(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function fragmentShaderSetup(fragShaderCode){
    shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, fragShaderCode);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function initShaders(vertexShaderCode, fragShaderCode) {
    shaderProgram = gl.createProgram();

    var vertexShader = vertexShaderSetup(vertexShaderCode);
    var fragmentShader = fragmentShaderSetup(fragShaderCode);

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);

    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.log(gl.getShaderInfoLog(vertexShader));
        console.log(gl.getShaderInfoLog(fragmentShader));
    }

    gl.useProgram(shaderProgram);

    return shaderProgram;
}

function pushMatrix(stack, m) {
    var duplicate = mat4.create(m);
    stack.push(duplicate);
}

function popMatrix(stack) {
    if (stack.length > 0) return stack.pop();
    else console.log("stack is Empty!");
}
function degToRad(degrees) {
    return (degrees * Math.PI) / 180;
}

function initSphere(nslices, nstacks, radius) {
    var theta1, theta2;
  
    for (i = 0; i < nslices; i++){
      spVerts.push(0);
      spVerts.push(-radius);
      spVerts.push(0);
  
      spNormals.push(0);
      spNormals.push(-1.0);
      spNormals.push(0);
    }
  
    for (i = 1; i < nstacks - 1; i++){
      theta1 = (i * 2 * Math.PI) / nslices - Math.PI / 2;
      for (j = 0; j < nslices; j++) {
        theta2 = (j * 2 * Math.PI) / nslices;
        spVerts.push(radius * Math.cos(theta1) * Math.cos(theta2));
        spVerts.push(radius * Math.sin(theta1));
        spVerts.push(radius * Math.cos(theta1) * Math.sin(theta2));
  
        spNormals.push(Math.cos(theta1) * Math.cos(theta2));
        spNormals.push(Math.sin(theta1));
        spNormals.push(Math.cos(theta1) * Math.sin(theta2));
      }
    }
  
    for (i = 0; i < nslices; i++) {
      spVerts.push(0);
      spVerts.push(radius);
      spVerts.push(0);
  
      spNormals.push(0);
      spNormals.push(1.0);
      spNormals.push(0);
    }
  
    for (i = 0; i < nstacks - 1; i++)
      for (j = 0; j <= nslices; j++) {
        var mi = j % nslices;
        var mi2 = (j + 1) % nslices;
        var idx = (i + 1) * nslices + mi;
        var idx2 = i * nslices + mi;
        var idx3 = i * nslices + mi2;
        var idx4 = (i + 1) * nslices + mi;
        var idx5 = i * nslices + mi2;
        var idx6 = (i + 1) * nslices + mi2;
  
        spIndicies.push(idx);
        spIndicies.push(idx2);
        spIndicies.push(idx3);
        spIndicies.push(idx4);
        spIndicies.push(idx5);
        spIndicies.push(idx6);
      }
  }

function initSphereBuffer() {
    var nslices = 30;
    var nstacks = nslices / 2 + 1;
    var radius = 1.0;
    initSphere(nslices, nstacks, radius);
  
    spBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
    spBuf.itemSize = 3;
    spBuf.numItems = nslices * nstacks;
  
    spNormalBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
    spNormalBuf.itemSize = 3;
    spNormalBuf.numItems = nslices * nstacks;
  
    spIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint32Array(spIndicies),
      gl.STATIC_DRAW
    );
    spIndexBuf.itemsize = 1;
    spIndexBuf.numItems = (nstacks - 1) * 6 * (nslices + 1);
}

function drawSphere(){

    gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
    gl.vertexAttribPointer(aPositionLocation, spBuf.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
    gl.vertexAttribPointer(aNormalLocation, spNormalBuf.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);

    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
    gl.uniform3fv(uLightPositionLocation, lightPosition);
    gl.uniform3fv(uAmbientColorLocation, ambientColor);
    gl.uniform3fv(uDiffuseColorLocation, diffuseColor);
    gl.uniform3fv(uSpecularColorLocation, specularColor);

    gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);
}

function initCubeBuffer() {
    var vertices = [
        // Front face
        -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
        // Back face
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
        // Top face
        -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
        // Bottom face
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
        // Right face
        0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
        // Left face
        -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
    ];
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    buf.itemSize = 3;
    buf.numItems = vertices.length / 3;
  
    var normals = [
        // Front face
        0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
        // Back face
        0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
        // Top face
        0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
        // Bottom face
        0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
        // Right face
        1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
        // Left face
        -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
    ];
    cubeNormalBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    cubeNormalBuf.itemSize = 3;
    cubeNormalBuf.numItems = normals.length / 3;
  
  
    var indices = [
      0,
      1,
      2,
      0,
      2,
      3, // front face
      4,
      5,
      6,
      4,
      6,
      7, // back face
      8,
      9,
      10,
      8,
      10,
      11, // top face
      12,
      13,
      14,
      12,
      14,
      15, // bottom face
      16,
      17,
      18,
      16,
      18,
      19, // right face
      20,
      21,
      22,
      20,
      22,
      23, // left face
    ];
    indexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    indexBuf.itemSize = 1;
    indexBuf.numItems = indices.length;
}

function drawCube() {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(aPositionLocation, buf.itemSize, gl.FLOAT, false,0,0);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
    gl.vertexAttribPointer(aNormalLocation, cubeNormalBuf.itemSize, gl.FLOAT, false,0,0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);

    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
    gl.uniform3fv(uLightPositionLocation, lightPosition);
    gl.uniform3fv(uAmbientColorLocation, ambientColor);
    gl.uniform3fv(uDiffuseColorLocation, diffuseColor);
    gl.uniform3fv(uSpecularColorLocation, specularColor);

    gl.drawElements(gl.TRIANGLES, indexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

function perFaceShading() {
    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

    mat4.identity(pMatrix);
    mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

    mat4.identity(mMatrix);
    mat4.identity(uNormalMatrix);

    mMatrix = mat4.rotate(mMatrix, degToRad(degree0), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(degree1), [1, 0, 0]);

    mMatrix = mat4.rotate(mMatrix, 0.5, [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, 0.2, [1, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, 0.1, [0, 0, 1]);

    mMatrix = mat4.scale(mMatrix, [1.1, 1.1, 1.1]);
    mMatrix = mat4.translate(mMatrix, [0, -0.1, 0]);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.5, 0]);
    mMatrix = mat4.scale(mMatrix, [0.25, 0.25, 0.25]);

    diffuseColor = [0, 0.4, 0.9];
    drawSphere();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.125, 0]);
    mMatrix = mat4.scale(mMatrix, [0.45, 0.76, 0.5]);

    diffuseColor = [0.7, 0.7, 0.45];
    drawCube();
    mMatrix = popMatrix(matrixStack);
}

function GouraudShading(){
    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

    mat4.identity(pMatrix);
    mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

    mat4.identity(mMatrix);

    mMatrix = mat4.rotate(mMatrix, degToRad(degree2), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(degree3), [1, 0, 0]);

    mMatrix = mat4.rotate(mMatrix, 0.05, [0, 1, 0]);
    mMatrix = mat4.scale(mMatrix, [0.95, 0.95, 0.95]);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.04, -0.45, 0.1]);
    mMatrix = mat4.scale(mMatrix, [0.7, 0.7, 0.7]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    
    diffuseColor = [0.82, 0.82, 0.82];
    drawSphere();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.36, -0.06, 0.15]);
    mMatrix = mat4.scale(mMatrix, [0.39, 0.39, 0.39]);
    mMatrix = mat4.rotate(mMatrix, 0.5, [1, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, -0.45, [0, 0, 1]);
    mMatrix = mat4.rotate(mMatrix, -0.5, [0, 1, 0]);
    diffuseColor = [0, 0.7, 0];
    drawCube();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.18, 0.24, 0.25]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    
    diffuseColor = [0.82, 0.82, 0.82];
    drawSphere();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.095, 0.41, 0.3]);
    mMatrix = mat4.scale(mMatrix, [0.25, 0.25, 0.25]);
    mMatrix = mat4.rotate(mMatrix, 0.5, [1, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, 0.5, [0, 0, 1]);
    mMatrix = mat4.rotate(mMatrix, 0.2, [0, 1, 0]);

    diffuseColor = [0, 0.7, 0];
    drawCube();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.02, 0.6, 0.4]);
    mMatrix = mat4.scale(mMatrix, [0.25, 0.25, 0.25]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    
    diffuseColor = [0.82, 0.82, 0.82];
    drawSphere();
    mMatrix = popMatrix(matrixStack);
}

function PhongShading() {
    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

    mat4.identity(pMatrix);
    mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

    mat4.identity(mMatrix);

    mMatrix = mat4.rotate(mMatrix, degToRad(degree4), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(degree5), [1, 0, 0]);

    mMatrix = mat4.rotate(mMatrix, degToRad(5), [0, 0, 1]);
    mMatrix = mat4.rotate(mMatrix, degToRad(35), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(8), [1, 0, 0]);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    diffuseColor = [0, 1, 0.2];
    drawSphere();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.2, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.015, 0]);
    mMatrix = mat4.translate(mMatrix, [0, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [1.35, 0.03, 0.25]);
    diffuseColor = [0.58, 0.19, 0.08];
    drawCube();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.15, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.2, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [-0.45, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [0.15, 0.15, 0.15]);
    diffuseColor = [0.26, 0.27, 0.9];
    drawSphere();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.15, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.2, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [0.45, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [0.15, 0.15, 0.15]);
    diffuseColor = [0.43, 0.51, 0.92];
    drawSphere();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.015, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.3, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.2, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [-0.45, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [0.3, 0.03, 0.6]);
    diffuseColor = [0.7, 0.6, 0.0];
    drawCube();
    mMatrix = popMatrix(matrixStack)

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.015, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.3, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.2, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [0.45, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [0.3, 0.03, 0.6]);
    diffuseColor = [0.48, 0.72, 0.89];
    drawCube();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.15, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.3, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.2, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [-0.45, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [0.3, 0.3, 0.3]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    diffuseColor = [0.89, 0.1, 0.89];
    drawSphere();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.15, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.3, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.2, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [0.45, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [0.15, 0.15, 0.15]);
    diffuseColor = [0.8, 0.5, 0.35];
    drawSphere();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.015, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.3, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.3, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.2, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [0, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [1.35, 0.03, 0.25]);
    diffuseColor = [0.58, 0.19, 0.08];
    drawCube();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.2, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.3, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.3, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.2, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0.03, 0]);
    mMatrix = mat4.translate(mMatrix, [0, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 0.2]);
    diffuseColor = [0.54, 0.54, 0.67];
    drawSphere();
    mMatrix = popMatrix(matrixStack);

};

function drawScene() {
    gl.enable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, 400, 400);
    gl.scissor(0, 0, 400, 400);

    gl.clearColor(0.85, 0.85, 0.95, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    shaderProgram = flatShaderProgram;
    gl.useProgram(shaderProgram);
    setAttributes();
    perFaceShading();

    gl.viewport(400, 0, 400, 400);
    gl.scissor(400, 0, 400, 400);

    gl.clearColor(0.95, 0.85, 0.85, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    shaderProgram = perVertShaderProgram;
    gl.useProgram(shaderProgram);
    setAttributes();
    GouraudShading();

    gl.viewport(800, 0, 400, 400);
    gl.scissor(800, 0, 400, 400);

    gl.clearColor(0.85, 0.95, 0.85, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    shaderProgram = perFragShaderProgram;
    gl.useProgram(shaderProgram);
    setAttributes();
    PhongShading();
};

function setAttributes() {
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
    uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
    uLightPositionLocation = gl.getUniformLocation(shaderProgram, 'uLightPosition');
    uAmbientColorLocation = gl.getUniformLocation(shaderProgram, 'uAmbientColor');
    uDiffuseColorLocation = gl.getUniformLocation(shaderProgram, 'uDiffuseColor');
    uSpecularColorLocation = gl.getUniformLocation(shaderProgram, 'uSpecularColor');

    gl.enableVertexAttribArray(aPositionLocation);
    gl.enableVertexAttribArray(aNormalLocation);

    initSphereBuffer();
    initCubeBuffer();

    gl.enable(gl.DEPTH_TEST);
}

function onMouseUp(e) {
    document.removeEventListener("mousemove", onMouseMove, false);
    document.removeEventListener("mouseup", onMouseUp, false);
    document.removeEventListener("mouseout", onMouseOut, false);
}

function onMouseOut(e) {
    document.removeEventListener("mousemove", onMouseMove, false);
    document.removeEventListener("mouseup", onMouseUp, false);
    document.removeEventListener("mouseout", onMouseOut, false);
}

function onMouseMove(e) {
    var mouseX = e.layerX;
    var diffX1 = mouseX - prevMouseX;
    prevMouseX = mouseX;

    var mouseY = canvas.height - e.layerY;
    var diffY2 = mouseY - prevMouseY;
    prevMouseY = mouseY;

    var limitY = mouseY <= 300 && mouseY >= -100;
    if (mouseX >= 50 && mouseX <= 450 && limitY && scene == 1) {
        degree0 = degree0 + diffX1 / 5;
        degree1 = degree1 - diffY2 / 5;
    }
    else if (mouseX >= 450 && mouseX <= 850 && limitY && scene == 2) {
        degree2 = degree2 + diffX1 / 5;
        degree3 = degree3 - diffY2 / 5;
    }
    else if (mouseX >= 850 && mouseX <= 1250 && limitY && scene == 3) {
        degree4 = degree4 + diffX1 / 5;
        degree5 = degree5 - diffY2 / 5;
    }
    drawScene();
}


function onMouseDown(e) {
    document.addEventListener("mouseout", onMouseOut, false);
    document.addEventListener("mousemove", onMouseMove, false);
    document.addEventListener("mouseup", onMouseUp, false);

    if ( e.layerX <= canvas.width && e.layerX >= 0 &&
         e.layerY <= canvas.height && e.layerY >= 0){
        prevMouseX = e.layerX;
        prevMouseY = canvas.height - e.layerY;
        var limitY = prevMouseY <= 300 && prevMouseY >= -100;
        if (prevMouseX >= 50 && prevMouseX <= 450 && limitY) scene = 1;
        else if (prevMouseX >= 450 && prevMouseX <= 850 && limitY) scene = 2;
        else if (prevMouseX >= 850 && prevMouseX <= 1250 && limitY) scene = 3;
    }
}

function webGLStart() {
    canvas = document.getElementById("canvas");
    document.addEventListener("mousedown", onMouseDown, false);

    const lightSlider = document.getElementById('light-slider');

    let lightX = parseFloat(lightSlider.value);

    lightSlider.addEventListener('input', (e) => {
        lightX = parseFloat(e.target.value);
        lightPosition = [lightX, 3.0, 4.0];

        drawScene();
    });

    const cameraSlider = document.getElementById('camera-slider');
    let viewZ = parseFloat(cameraSlider.value);

    cameraSlider.addEventListener('input', (e) => {
        viewZ = parseFloat(e.target.value);
        eyePos = [0.0, 0.0, viewZ];

        drawScene();
    });

    initGL(canvas);

    flatShaderProgram = initShaders(flatVertexShaderCode, flatFragShaderCode);
    perVertShaderProgram = initShaders(perVertVertexShaderCode, perVertFragShaderCode);
    perFragShaderProgram = initShaders(perFragVertexShaderCode, perFragFragShaderCode);

    drawScene();
}
