var gl;
var canvas;
var matrixStack = [];

var animation;
var zAngle = 0.0;
var yAngle = 0.0;
var prevMouseX = 0.0;
var prevMouseY = 0.0;

var aPositionLocation;
var aNormalLocation;
var aTexCoordLocation;

var uVMatrixLocation;
var uMMatrixLocation;
var uPMatrixLocation;
var uWNMatrixLocation;

var uEyePosLocation;

var uObjectLocation;

var uLightPositionLocation;
var uDiffuseColorLocation;
var uSpecularColorLocation;
var uAmbientColorLocation;

var lightPosition = [3.5, 4, 0];
var ambientColor = [0.0, 0.0, 0.0];
var diffuseColor = [1.0, 1.0, 1.0];
var specularColor = [1.0, 1.0, 1.0];

var vMatrix = mat4.create();
var mMatrix = mat4.create();
var pMatrix = mat4.create();
var wNMatrix = mat3.create();

var objVertexPositionBuffer;
var objVertexNormalBuffer;
var objVertexTextureBuffer;
var objVertexIndexBuffer;

var spBuf;
var spIndexBuf;
var spNormalBuf;
var spTexBuf;

var spVerts = [];
var spIndicies = [];
var spNormals = [];
var spTexCoords = [];

var cubeVerts = [];
var cubeIndices = [];
var cubeNormals = [];
var cubeTexCoords = [];

var cubeBuf;
var cubeIndexBuf;
var cubeNormalBuf;
var cubeTexBuf;

var squareVerts = [];
var squareIndices = [];
var squareNormals = [];
var squareTexCoords = [];

var sqBuf;
var sqIndexBuf;
var sqNormalBuf;
var sqTexBuf;

var cubemapTexture;
input_JSON = "./texture_and_other_files/teapot.json";

var uTextureLocation;
var uCubeMapLocation;

var eyePos = [0.0, 1.0, 4.0];
var COI = [0.0, 0.0, 0.0];
var viewUp = [0.0, 1.0, 0.0];

var lightPosition = [0, 18, 8];

var eyeAng = 0;
var eyeStep = 0.006;

const vertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoord;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
uniform mat3 uNMatrix;
uniform mat4 uWNMatrix;

out vec3 posInWorldSpace;
out vec3 posInEyeSpace;
out vec3 vNormal;
out vec3 vWorldNormal;
out vec2 vTexCoord;

void main() {
  mat4 projectionModelView = uPMatrix * uVMatrix * uMMatrix;
  gl_Position = projectionModelView * vec4(aPosition, 1.0);

  posInWorldSpace = vec3(uMMatrix * vec4(aPosition, 1.0));
  posInEyeSpace = vec3(uVMatrix * uMMatrix * vec4(aPosition, 1.0));
  vNormal = normalize(aNormal);
  vWorldNormal = normalize(mat3(uWNMatrix) * aNormal);

  vTexCoord = aTexCoord;
}`;

const fragShaderCode = `#version 300 es
precision highp float;
in vec3 posInWorldSpace;
in vec3 posInEyeSpace;
in vec3 vNormal;
in vec3 vWorldNormal;
in vec2 vTexCoord;

uniform vec3 uLightPosition;
uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;
uniform sampler2D uTexture;
uniform samplerCube uCubeMap;
uniform vec3 uEyePos;

uniform bool uReflect;
uniform bool uRefract;
uniform bool uColor;
uniform bool uShine;
uniform bool uCage;
uniform bool uText;

out vec4 fragColor;

void main() {

  vec3 normal = normalize(vNormal);
  vec3 lightVector = normalize(uLightPosition - posInEyeSpace);
  vec3 diffuse = max(dot(normal, lightVector), 0.0) * uDiffuseColor;
  vec3 viewVector = normalize(-posInEyeSpace);
  vec3 reflectionVector = reflect(-lightVector, normal);
  vec3 specular = pow(max(dot(viewVector, reflectionVector), 0.0), 25.0) * uSpecularColor;
  vec3 ambient = uAmbientColor*0.15;
  vec4 vColor = vec4(diffuse + ambient + specular, 1.0);
  vec4 shine = vec4(specular, 1.0);

  vec4 textColor =  texture(uTexture, vTexCoord);
  
  vec3 worldNormal = normalize(vWorldNormal);
  vec3 eyeToSurfaceDir = normalize(posInWorldSpace - uEyePos);
  vec3 directionReflection = reflect(eyeToSurfaceDir, worldNormal);
  vec4 reflColor = texture(uCubeMap, directionReflection);
  
  vec3 directionRefraction = refract(eyeToSurfaceDir, worldNormal, 0.99);
  vec4 refrColor = texture(uCubeMap, directionRefraction);

  fragColor = vec4(0.0, 0.0, 0.0, 0.0);

  if(uText) fragColor += textColor;
  if(uShine) fragColor += shine;
  if(uReflect) fragColor += reflColor;
  if(uRefract) fragColor += refrColor;
  if(uColor) fragColor += vColor;
  if(uCage){
  if(textColor.a <= 0.01)
      discard;
    else
      fragColor = textColor + vColor;
  }
}
`;

function pushMatrix(stack, m) {
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
}

function vertexShaderSetup(vertexShaderCode) {
  shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, vertexShaderCode);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup(fragShaderCode) {
  shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, fragShaderCode);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders() {
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

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function initObject() {
  var request = new XMLHttpRequest();
  request.open("GET", input_JSON);
  request.overrideMimeType("application/json");
  request.onreadystatechange = function () {
    if (request.readyState == 4) {
      processObject(JSON.parse(request.responseText));
    }
  };
  request.send();
}

function processObject(objData) {
  objVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(objData.vertexPositions),
    gl.STATIC_DRAW
  );
  objVertexPositionBuffer.itemSize = 3;
  objVertexPositionBuffer.numItems = objData.vertexPositions.length / 3;

  objVertexNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
  gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(objData.vertexNormals),
      gl.STATIC_DRAW
  );
  objVertexNormalBuffer.itemSize = 3;
  objVertexNormalBuffer.numItems = objData.vertexNormals.length / 3;

  objVertexTextureBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexTextureBuffer);
  gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(objData.vertexTextureCoords),
      gl.STATIC_DRAW
  );
  objVertexTextureBuffer.itemSize = 2;
  objVertexTextureBuffer.numItems = objData.vertexTextureCoords.length / 2;

  objVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(objData.indices),
    gl.STATIC_DRAW
  );
  objVertexIndexBuffer.itemSize = 1;
  objVertexIndexBuffer.numItems = objData.indices.length;

  drawScene();
}

function drawObject(color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    objVertexPositionBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
  gl.vertexAttribPointer(
      aNormalLocation,
      objVertexNormalBuffer.itemSize,
      gl.FLOAT,
      false,
      0,
      0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexTextureBuffer);
  gl.vertexAttribPointer(
      aTexCoordLocation,
      objVertexTextureBuffer.itemSize,
      gl.FLOAT,
      false,
      0,
      0
  );

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);

  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

  wNMatrix = mat4.transpose(mat4.inverse(mMatrix));
  gl.uniformMatrix4fv(uWNMatrixLocation, false, wNMatrix);

  gl.uniform3fv(uEyePosLocation, eyePos);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.uniform1i(uTextureLocation, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);
  gl.uniform1i(uCubeMapLocation, 1);

  gl.drawElements(
    gl.TRIANGLES,
    objVertexIndexBuffer.numItems,
    gl.UNSIGNED_INT,
    0
  );
}

function initSphere(nslices, nstacks, radius) {
  for (var i = 0; i <= nslices; i++) {
    var angle = (i * Math.PI) / nslices;
    var comp1 = Math.sin(angle);
    var comp2 = Math.cos(angle);

    for (var j = 0; j <= nstacks; j++) {
      var phi = (j * 2 * Math.PI) / nstacks;
      var comp3 = Math.sin(phi);
      var comp4 = Math.cos(phi);

      var xcood = comp4 * comp1;
      var ycoord = comp2;
      var zcoord = comp3 * comp1;
      var utex = 1 - j / nstacks;
      var vtex = 1 - i / nslices;

      spVerts.push(radius * xcood, radius * ycoord, radius * zcoord);
      spNormals.push(xcood, ycoord, zcoord);
      spTexCoords.push(utex, vtex);
    }
  }

  for (var i = 0; i < nslices; i++) {
    for (var j = 0; j < nstacks; j++) {
      var id1 = i * (nstacks + 1) + j;
      var id2 = id1 + nstacks + 1;

      spIndicies.push(id1, id2, id1 + 1);
      spIndicies.push(id2, id2 + 1, id1 + 1);
    }
  }
}

function initSphereBuffer() {
  var nslices = 50;
  var nstacks = 50;
  var radius = 1.0;

  initSphere(nslices, nstacks, radius);

  spBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
  spBuf.itemSize = 3;
  spBuf.numItems = spVerts.length / 3;

  spIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(spIndicies),
    gl.STATIC_DRAW
  );
  spIndexBuf.itemsize = 1;
  spIndexBuf.numItems = spIndicies.length;

  spNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
  spNormalBuf.itemSize = 3;
  spNormalBuf.numItems = spNormals.length / 3;

  spTexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spTexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spTexCoords), gl.STATIC_DRAW);
  spTexBuf.itemSize = 2;
  spTexBuf.numItems = spTexCoords.length / 2;
}

function drawSphere(color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    spBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.vertexAttribPointer(
    aNormalLocation,
    spNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, spTexBuf);
  gl.vertexAttribPointer(
    aTexCoordLocation,
    spTexBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);

  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

  gl.uniform3fv(uLightPositionLocation, lightPosition);
  gl.uniform3fv(uAmbientColorLocation, ambientColor);
  gl.uniform3fv(uDiffuseColorLocation, diffuseColor);
  gl.uniform3fv(uSpecularColorLocation, specularColor);

  wNMatrix = mat4.transpose(mat4.inverse(mMatrix));
  gl.uniformMatrix4fv(uWNMatrixLocation, false, wNMatrix);

  gl.uniform3fv(uEyePosLocation, eyePos);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.uniform1i(uTextureLocation, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);
  gl.uniform1i(uCubeMapLocation, 1);

  gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);
}

function initCube() {
  cubeVerts = [
    -1.0, -1.0,  1.0,
     1.0, -1.0,  1.0,
     1.0,  1.0,  1.0,
    -1.0,  1.0,  1.0,

    -1.0, -1.0, -1.0,
     1.0, -1.0, -1.0,
     1.0,  1.0, -1.0,
    -1.0,  1.0, -1.0,

    -1.0,  1.0, -1.0,
     1.0,  1.0, -1.0,
     1.0,  1.0,  1.0,
    -1.0,  1.0,  1.0,

    -1.0, -1.0, -1.0,
     1.0, -1.0, -1.0,
     1.0, -1.0,  1.0,
    -1.0, -1.0,  1.0,

     1.0, -1.0, -1.0,
     1.0,  1.0, -1.0,
     1.0,  1.0,  1.0,
     1.0, -1.0,  1.0,

    -1.0, -1.0, -1.0,
    -1.0,  1.0, -1.0,
    -1.0,  1.0,  1.0,
    -1.0, -1.0,  1.0
  ];

  cubeTexCoords = [
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0 
  ];

  cubeNormals = [
     0.0,  0.0,  1.0,  0.0,  0.0,  1.0,  0.0,  0.0,  1.0,  0.0,  0.0,  1.0,

     0.0,  0.0, -1.0,  0.0,  0.0, -1.0,  0.0,  0.0, -1.0,  0.0,  0.0, -1.0,

     0.0,  1.0,  0.0,  0.0,  1.0,  0.0,  0.0,  1.0,  0.0,  0.0,  1.0,  0.0,

     0.0, -1.0,  0.0,  0.0, -1.0,  0.0,  0.0, -1.0,  0.0,  0.0, -1.0,  0.0,

     1.0,  0.0,  0.0,  1.0,  0.0,  0.0,  1.0,  0.0,  0.0,  1.0,  0.0,  0.0,

    -1.0,  0.0,  0.0, -1.0,  0.0,  0.0, -1.0,  0.0,  0.0, -1.0,  0.0,  0.0
  ];

  cubeIndices = [
    0, 1, 2,   0, 2, 3,
    4, 5, 6,   4, 6, 7,
    8, 9, 10,  8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23
  ];
}

function initCubeBuffer() {
  initCube();

  cubeBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeVerts), gl.STATIC_DRAW);
  cubeBuf.itemSize = 3;
  cubeBuf.numItems = cubeVerts.length / 3;

  cubeTexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeTexCoords), gl.STATIC_DRAW);
  cubeTexBuf.itemSize = 2;
  cubeTexBuf.numItems = cubeTexCoords.length / 2;

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

function drawCube(color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    cubeBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
  gl.vertexAttribPointer(
    aNormalLocation,
    cubeNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexBuf);
  gl.vertexAttribPointer(
    aTexCoordLocation,
    cubeTexBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);

  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

  gl.uniform3fv(uLightPositionLocation, lightPosition);
  gl.uniform3fv(uAmbientColorLocation, ambientColor);
  gl.uniform3fv(uDiffuseColorLocation, diffuseColor);
  gl.uniform3fv(uSpecularColorLocation, specularColor);

  wNMatrix = mat4.transpose(mat4.inverse(mMatrix));
  gl.uniformMatrix4fv(uWNMatrixLocation, false, wNMatrix);

  gl.uniform3fv(uEyePosLocation, eyePos);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.uniform1i(uTextureLocation, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);
  gl.uniform1i(uCubeMapLocation, 1);

  gl.drawElements(gl.TRIANGLES, cubeIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

function initSquare() {
  squareVerts = [
    -1.0, -1.0, 0.0,
     1.0, -1.0, 0.0,
     1.0,  1.0, 0.0,
    -1.0,  1.0, 0.0
  ];

  squareTexCoords = [
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0
  ];

  squareNormals = [
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0
  ];

  squareIndices = [
    0, 1, 2,
    0, 2, 3
  ];
}

function initSquareBuffer() {
  initSquare();
  sqBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(squareVerts), gl.STATIC_DRAW);
  sqBuf.itemSize = 3;
  sqBuf.numItems = squareVerts.length / 3;

  sqIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqIndexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(squareIndices), gl.STATIC_DRAW);
  sqIndexBuf.itemSize = 1;
  sqIndexBuf.numItems = squareIndices.length;

  sqTexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqTexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(squareTexCoords), gl.STATIC_DRAW);
  sqTexBuf.itemSize = 2;
  sqTexBuf.numItems = squareTexCoords.length / 2;

  sqNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(squareNormals), gl.STATIC_DRAW);
  sqNormalBuf.itemSize = 3;
  sqNormalBuf.numItems = squareNormals.length / 3;
}

function drawSquare() {
  gl.bindBuffer(gl.ARRAY_BUFFER, sqBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    sqBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, sqNormalBuf);
  gl.vertexAttribPointer(
    aNormalLocation,
    sqNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, sqTexBuf);
  gl.vertexAttribPointer(
    aTexCoordLocation,
    sqTexBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqIndexBuf);

  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

  gl.uniform3fv(uEyePosLocation, eyePos);
  
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.uniform1i(uTextureLocation, 0);
  
  gl.drawElements(gl.TRIANGLES, sqIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

function initCubeMap() {
  const faceImages = [
    { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, url: "./texture_and_other_files/field/posx.png"},
    { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, url: "./texture_and_other_files/field/negx.png"},
    { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, url: "./texture_and_other_files/field/posy.png"},
    { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, url: "./texture_and_other_files/field/negy.png"},
    { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, url: "./texture_and_other_files/field/posz.png"},
    { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, url: "./texture_and_other_files/field/negz.png"},
  ];

  cubemapTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);

  faceImages.forEach((face) => {
    const { target, url } = face;

    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 512;
    const height = 512;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;

    gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

    const image = new Image();
    image.src = url;
    image.addEventListener("load", function () {
      gl.texImage2D(target, level, internalFormat, format, type, image);
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
      drawScene();
    });
  });

  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
}

function initTextures(textureFile) {
  var tex = gl.createTexture();
  tex.image = new Image();
  tex.image.src = textureFile;
  tex.image.onload = function () {
    handleTextureLoaded(tex);
  };
  return tex;
}

function handleTextureLoaded(texture) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    texture.image
  );
  
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );
  
  drawScene();
}


function drawSkybox(){
  gl.uniform1i(uTextLocation, 1);
  gl.depthMask(false);
  const size = 300.0;
  
  imageTexture = posx;
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [size, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, degToRad(90), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(0), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [size, size, size]);
  drawSquare();
  mMatrix = popMatrix(matrixStack);
  
  imageTexture = negx;
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-size, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-90), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(0), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [size, size, size]);
  drawSquare();
  mMatrix = popMatrix(matrixStack);

  imageTexture = posy;
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, size, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(0), [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, degToRad(0), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(90), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [size, size, size]);
  drawSquare();
  mMatrix = popMatrix(matrixStack);
  
  imageTexture = negy;
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, -size, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(0), [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, degToRad(0), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-90), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [size, size, size]);
  drawSquare();
  mMatrix = popMatrix(matrixStack);
  
  imageTexture = posz;
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, 0, size]);
  mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(0), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [size, size, size]);
  drawSquare();
  mMatrix = popMatrix(matrixStack);
  
  imageTexture = negz;
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, 0, -size]);
  mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, degToRad(0), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(0), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [size, size, size]);
  drawSquare();
  mMatrix = popMatrix(matrixStack);
  
  gl.depthMask(true);
  gl.uniform1i(uTextLocation, 0);
}

function drawTable() {
  gl.uniform1i(uTextLocation, 1);

  pushMatrix(matrixStack, mMatrix);
  imageTexture = wood_texture;
  mMatrix = mat4.translate(mMatrix, [0.0, 0, 0.0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(0), [0, 0, 1]);
  mMatrix = mat4.scale(mMatrix, [2.8, 0.04, 2.8]);
  drawSphere();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  imageTexture = wood_texture;
  mMatrix = mat4.translate(mMatrix, [-1.65, -1.4, -0.5]);
  mMatrix = mat4.scale(mMatrix, [0.075, 1.4, 0.075]);
  drawCube();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  imageTexture = wood_texture;
  mMatrix = mat4.translate(mMatrix, [-1.65, -1.4, 0.5]);
  mMatrix = mat4.scale(mMatrix, [0.075, 1.4, 0.075]);
  drawCube();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  imageTexture = wood_texture;
  mMatrix = mat4.translate(mMatrix, [1.65, -1.4, -0.5]);
  mMatrix = mat4.scale(mMatrix, [0.075, 1.4, 0.075]);
  drawCube();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  imageTexture = wood_texture;
  mMatrix = mat4.translate(mMatrix, [1.65, -1.4, 0.5]);
  mMatrix = mat4.scale(mMatrix, [0.075, 1.4, 0.075]);
  drawCube();
  mMatrix = popMatrix(matrixStack);
  gl.uniform1i(uTextLocation, 0);
}

function drawTeapot(){
  gl.uniform1i(uReflectLocation, 1);
  gl.uniform1i(uShineLocation, 1);
  pushMatrix(matrixStack, mMatrix);
  color = [0.7, 0.2, 0.2, 1.0];
  mMatrix = mat4.translate(mMatrix, [0, 0.75, 0]);
  mMatrix = mat4.scale(mMatrix, [0.1, 0.1, 0.1]);
  drawObject(color);
  mMatrix = popMatrix(matrixStack);
  gl.uniform1i(uReflectLocation, 0);
  gl.uniform1i(uShineLocation, 0);
}

function drawEarth() {
  gl.uniform1i(uTextLocation, 1);
  gl.uniform1i(uShineLocation, 1);
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.6, 0.38, 1.7]);
  mMatrix = mat4.scale(mMatrix, [0.35, 0.35, 0.35]);
  imageTexture = earthmap;
  drawSphere();
  mMatrix = popMatrix(matrixStack);
  gl.uniform1i(uShineLocation, 0);
  gl.uniform1i(uTextLocation, 0);
}

function drawSmallSphere() {
  gl.uniform1i(uColorLocation, 1);
  gl.uniform1i(uReflectLocation, 1);
  gl.uniform1i(uShineLocation, 1);
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [1.0, 0.4, 1.0]);
  mMatrix = mat4.scale(mMatrix, [0.28, 0.28, 0.28]);
  diffuseColor = [0.0, 0.0, 1.0];
  drawSphere();
  mMatrix = popMatrix(matrixStack);
  gl.uniform1i(uColorLocation, 0);
  gl.uniform1i(uReflectLocation, 0);
  gl.uniform1i(uShineLocation, 0);
}

function drawCage() {
  gl.uniform1i(uTextLocation, 1);
  gl.uniform1i(uCageLocation, 1);
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [1.0, 0.42, 1.0]);
  mMatrix = mat4.scale(mMatrix, [0.32, 0.32, 0.32]);
  imageTexture = fence_alpha;
  diffuseColor = [0.0, 0.0, 0.0];
  drawCube();
  mMatrix = popMatrix(matrixStack);
  gl.uniform1i(uCageLocation, 0);
  gl.uniform1i(uTextLocation, 0);
}

function drawGlass(){
  gl.uniform1i(uRefractLocation, 1);
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-1.5, 0.5, 1.1]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-24), [0, 1, 0]);
  mMatrix = mat4.scale(mMatrix, [0.23, 0.55, 0.032]);
  drawCube();
  mMatrix = popMatrix(matrixStack);
  gl.uniform1i(uRefractLocation, 0);
}

function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  
  if (animation) {
    window.cancelAnimationFrame(animation);
  }
  
  var animate = function(){
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    
    mat4.identity(mMatrix);

    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);
    
    mat4.identity(pMatrix);
    mat4.perspective(60, 1.0, 0.01, 1000, pMatrix);
    
    mMatrix = mat4.rotate(mMatrix, degToRad(zAngle), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(yAngle), [1, 0, 0]);
    
    drawSkybox();
    drawTable();
    drawTeapot();
    drawEarth();
    drawSmallSphere();
    drawCage();
    drawGlass();
  
      eyePos[0] = 3.5 * Math.sin(eyeAng);
      eyePos[2] = 3.5 * Math.cos(eyeAng);
      eyeAng -= eyeStep;

    animation = window.requestAnimationFrame(animate);
  }
  animate();
}


function onMouseDown(event) {
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("mouseup", onMouseUp, false);
  document.addEventListener("mouseout", onMouseOut, false);

  if (
    event.layerX <= canvas.width &&
    event.layerX >= 0 &&
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    prevMouseX = event.clientX;
    prevMouseY = canvas.height - event.clientY;
  }
}

function onMouseMove(event) {
  if (
    event.layerX <= canvas.width &&
    event.layerX >= 0 &&
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    var mouseX = event.clientX;
    var diffX = mouseX - prevMouseX;
    zAngle = zAngle + diffX / 5;
    prevMouseX = mouseX;

    var mouseY = canvas.height - event.clientY;
    var diffY = mouseY - prevMouseY;
    yAngle = yAngle - diffY / 5;
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
  canvas = document.getElementById("TextureCubeEnvMapping");
  document.addEventListener("mousedown", onMouseDown, false);

  initGL(canvas);
  shaderProgram = initShaders();

  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
  aTexCoordLocation = gl.getAttribLocation(shaderProgram, "aTexCoord");

  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
  uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
  uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
  uWNMatrixLocation = gl.getUniformLocation(shaderProgram, "uWNMatrix");

  uLightPositionLocation = gl.getUniformLocation(shaderProgram, "uLightPosition");
  uAmbientColorLocation = gl.getUniformLocation(shaderProgram, "uAmbientColor");
  uDiffuseColorLocation = gl.getUniformLocation(shaderProgram, "uDiffuseColor");
  uSpecularColorLocation = gl.getUniformLocation(shaderProgram, "uSpecularColor");

  uEyePosLocation = gl.getUniformLocation(shaderProgram, "uEyePos");

  uRefractLocation = gl.getUniformLocation(shaderProgram, "uRefract");
  uReflectLocation = gl.getUniformLocation(shaderProgram, "uReflect");
  uCageLocation = gl.getUniformLocation(shaderProgram, "uCage");
  uColorLocation = gl.getUniformLocation(shaderProgram, "uColor");
  uShineLocation = gl.getUniformLocation(shaderProgram, "uShine");
  uTextLocation = gl.getUniformLocation(shaderProgram, "uText")

  uTextureLocation = gl.getUniformLocation(shaderProgram, "uTexture");
  uCubeMapLocation = gl.getUniformLocation(shaderProgram, "uCubeMap");

  gl.enableVertexAttribArray(aPositionLocation);
  gl.enableVertexAttribArray(aNormalLocation);
  gl.enableVertexAttribArray(aTexCoordLocation);

  initSphereBuffer();
  initCubeBuffer();
  initSquareBuffer();
  initCubeMap();
  initObject();

  posx = initTextures("./texture_and_other_files/field/posx.png");
  negx = initTextures("./texture_and_other_files/field/negx.png");
  posy = initTextures("./texture_and_other_files/field/posy.png");
  negy = initTextures("./texture_and_other_files/field/negy.png");
  posz = initTextures("./texture_and_other_files/field/posz.png");
  negz = initTextures("./texture_and_other_files/field/negz.png");
  earthmap = initTextures("./texture_and_other_files/earthmap.jpg");
  wood_texture = initTextures("./texture_and_other_files/wood_texture.jpg");
  fence_alpha = initTextures("./texture_and_other_files/fence_alpha.png");
  
  drawScene();
}
