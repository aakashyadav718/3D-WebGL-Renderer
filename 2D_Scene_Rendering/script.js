// Init 
var gl;
var shaderProgram;
var uMMatrixLocation;
var uColorLoc;
var aPositionLocation;
var mode = 's';

var mMatrix = mat4.create();
mat4.identity(mMatrix);

const vertexShaderCode = `#version 300 es
in vec2 aPosition;
uniform mat4 uMMatrix;

void main() {
    gl_Position = uMMatrix * vec4(aPosition, 0.0, 1.0);
    gl_PointSize = 2.0;
}`;

const fragmentShaderCode = `#version 300 es
precision mediump float;
uniform vec4 uColor;
out vec4 fragColor;

void main() {
    fragColor = uColor;
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
    const shader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(shader, vertexShaderCode);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function fragmentShaderSetup(fragShaderCode) {
    const shader = gl.createShader(gl.FRAGMENT_SHADER);
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
    const vertexShader = vertexShaderSetup(vertexShaderCode);
    const fragmentShader = fragmentShaderSetup(fragmentShaderCode);

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.log(gl.getShaderInfoLog(vertexShader));
        console.log(gl.getShaderInfoLog(fragmentShader));
    }

    gl.useProgram(shaderProgram);

    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uColorLoc = gl.getUniformLocation(shaderProgram, "uColor");

    gl.enableVertexAttribArray(aPositionLocation);

    initSquareBuffer();
    initTriangleBuffer();
    initCircleBuffer();

    drawScene();
}

function webGLStart() {
    const canvas = document.getElementById("scenery");
    initGL(canvas);
    initShaders();
}

// Animation 
var animation;
var rotationAngle = 0;
var rotAngle=0;
var rotationSpeed = 0.04;
var rotSpeed=0.02;
var translationX = 0;
var transX=0;
var translationSpeed = 0.0023;
var transXSpeed=0.0015;
var translationRange = 0.7;
var transRange = 0.8;
var direction = 1;
var dir=1;

function animate() {
    rotationAngle -= rotationSpeed;
    rotAngle += rotSpeed;
    translationX += translationSpeed * direction;
    transX += transXSpeed * dir;
    if (Math.abs(translationX) > translationRange) {
        direction *= -1;
    }
    if(Math.abs(transX)>transRange){
        dir *= -1;
    }
    drawScene();

    animation = window.requestAnimationFrame(animate);
}

function drawScene() {
    let mMatrix = mat4.create();
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clearColor(0.95, 0.95, 0.95, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (animation) {
        window.cancelAnimationFrame(animation);
    }

    drawSky();
    drawMoon(rotAngle);
    drawCloud();
    drawStar();
    drawMountains();
    drawGround();
    drawRoad();
    drawTrees();
    drawSmallBoat(transX);
    drawBoat(translationX);
    drawSmallFan(rotationAngle);
    drawFan(rotationAngle);
    drawBushes();
    drawHouse();
    drawCar();

    animation = window.requestAnimationFrame(animate);
}

function changeView(m) {
    mode = m;
    drawScene();
}

const numSegments = 60;
const angleIncrement = (Math.PI * 2) / numSegments;
let matrixStack = [];

function initSquareBuffer(){

    const sqVertices = new Float32Array([
        0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    ]);
    sqVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sqVertices, gl.STATIC_DRAW);
    sqVertexPositionBuffer.itemSize = 2;
    sqVertexPositionBuffer.numItems = 4;

    // buffer for point indices
    const sqIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    sqVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sqIndices, gl.STATIC_DRAW);
    sqVertexIndexBuffer.itemsize = 1;
    sqVertexIndexBuffer.numItems = 6;
}

// Drawing functions

function drawSquare(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

    // buffer for point locations
    gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
    gl.vertexAttribPointer(aPositionLocation, sqVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    // buffer for point indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);
    gl.uniform4fv(uColorLoc, color);

    // Draw the square
    if (mode === 's') {
        gl.drawElements(gl.TRIANGLES, sqVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    } else if (mode === 'w') {
        gl.drawElements(gl.LINE_LOOP, sqVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    } else if (mode === 'p') {
        gl.drawElements(gl.POINTS, sqVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    }
}

// drawing a triangle
function initTriangleBuffer() {
    // buffer for point locations
    const triangleVertices = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]);
    triangleBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
    triangleBuf.itemSize = 2;
    triangleBuf.numItems = 3;

    // buffer for point indices
    const triangleIndices = new Uint16Array([0, 1, 2]);
    triangleIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangleIndices, gl.STATIC_DRAW);
    triangleIndexBuf.itemsize = 1;
    triangleIndexBuf.numItems = 3;
}

function drawTriangle(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
    gl.vertexAttribPointer(aPositionLocation, triangleBuf.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);
    gl.uniform4fv(uColorLoc, color);

    // Draw the triangle
    if (mode === 's') {
        gl.drawElements(gl.TRIANGLES, triangleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    } else if (mode === 'w') {
        gl.drawElements(gl.LINE_LOOP, triangleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    } else if (mode === 'p') {
        gl.drawElements(gl.POINTS, triangleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
}

// drawing a circle
function initCircleBuffer(){
    const positions = [0, 0];
    
    for (let i = 0; i < numSegments; i++) {
      const angle = angleIncrement * i;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      positions.push(x, y);
    }

    const circleVertices = new Float32Array(positions);
    circleBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, circleVertices, gl.STATIC_DRAW);
    circleBuf.itemSize = 2;
    circleBuf.numItems = numSegments + 1;

    const indices = [0, 1, numSegments];
    for (let i = 0; i < numSegments; i++) {
      indices.push(0, i, i + 1);
    }

    const circleIndices = new Uint16Array(indices);
    circleIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, circleIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, circleIndices, gl.STATIC_DRAW);
    circleIndexBuf.itemsize = 1;
    circleIndexBuf.numItems = indices.length;
}

function drawCircle(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
    gl.vertexAttribPointer(aPositionLocation, circleBuf.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, circleIndexBuf);
    gl.uniform4fv(uColorLoc, color);

    if (mode === 's') {
        gl.drawElements(gl.TRIANGLES, circleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
    else if (mode === 'w') {
        gl.drawElements(gl.LINE_LOOP, circleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
    else if (mode === 'p') {
        gl.drawElements(gl.POINTS, circleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    }
}
function pushMatrix(stack, matrix) {
    const copy = mat4.create(); // Create a new matrix
    mat4.copy(copy, matrix); // Copy the matrix values
    stack.push(copy); // Push the cloned matrix onto the stack
}
function popMatrix(stack) {
    if (stack.length === 0) {
        throw "Invalid popMatrix!";
    }
    return stack.pop(); // Pop and return the last matrix on the stack
}

// DrawScene Function 
function drawScene() {

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clearColor(0.95, 0.95, 0.95, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (animation) {
        window.cancelAnimationFrame(animation);
    }

    function animate(){
        rotationAngle -= rotationSpeed;
        rotAngle += rotSpeed;
    
        translationX += translationSpeed * direction;
        transX += transXSpeed * dir;
  
        if (Math.abs(translationX) > translationRange) {
            direction *= -1;
        }
        if(Math.abs(transX)>transRange){
            dir *= -1;
        }
       
        drawSky();

        drawMoon(rotAngle);

        drawCloud();

        const time = performance.now() / 1000;

        drawStar(0.34, 0.78, 0.015, 0.031, 0.0, time);
        drawStar(0.55, 0.9, 0.012, 0.02, 0.0, time);
        drawStar(-0.08, 0.65, 0.01, 0.018, 0.0, time);
        drawStar(-0.135, 0.55, 0.005, 0.013, 0.0, time);
        drawStar(-0.21, 0.73, 0.009, 0.018, 0.0, time);

        drawMountain(-0.6, 0.09, 1.2, 0.27, -0.572, 0.0935);
        drawMountain(-0.076, 0.09, 1.8, 0.55, -0.014, 0.096);
        drawMountain(0.7, 0.12, 1.0, 0.28, -0.545, -0.005, true);

        drawGround();
        drawRoad();
        drawRiver();

        drawTrees(true, 0.35, 0, 0.85, 0.84)
        drawTrees();
        drawTrees(true, -0.1, 0, 0.8, 0.75)

        drawSmallBoat(transX);
        drawBoat(translationX);
        
        drawSmallFan(rotationAngle);
        DrawBigfan(rotationAngle);

        drawBush(true, -0.09, -0.13, 0.9);
        drawBush(true, 0.8, 0, 1.12);
        drawBush(true, 1.48, -0.175, 1.6);
        drawBush(true, 1.98, 0.115, 1.1);

        drawHouse();

        drawCar();
        animation = window.requestAnimationFrame(animate);
    }
    animate();
}

// Function to draw Sky
function drawSky() {
    let mMatrix = mat4.create();
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1]; 
    mMatrix = mat4.translate(mMatrix, [0.0, 0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [3.0, 1.2, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

// Function to Draw Moon
function drawMoon(rotAngle){
    mat4.identity(mMatrix);
    color = [1, 1, 1, 1];
    pushMatrix(matrixStack,mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.8, 0.84, 0]);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.1, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.rotate(mMatrix, rotAngle, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.26, 0.007, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.rotate(mMatrix, Math.PI/4+rotAngle, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.26, 0.007, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.rotate(mMatrix, Math.PI/2+rotAngle, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.26, 0.007, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.rotate(mMatrix, 3*Math.PI/4+rotAngle, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.26, 0.007, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    mMatrix = popMatrix(matrixStack);
}

// Function to DrawCloud
function drawCloud() {
    
    mat4.identity(mMatrix);
    pushMatrix(matrixStack,mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.04, 0.0003, 0]);

    pushMatrix(matrixStack, mMatrix);
    color = [168/255, 168/255, 168/255, 1];
    mMatrix = mat4.translate(mMatrix, [-0.8, 0.55, 0]);
    mMatrix = mat4.scale(mMatrix, [0.21, 0.137, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [1.0, 1.0, 1.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.55, 0.52, 0]);
    mMatrix = mat4.scale(mMatrix, [0.17, 0.11, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    
    pushMatrix(matrixStack, mMatrix);
    color = [197/255, 197/255, 197/255, 1];
    mMatrix = mat4.translate(mMatrix, [-0.35, 0.52, 0]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.07, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);  
    
    popMatrix(matrixStack);
}

// DrawStars Functions
function drawStar(center_x, center_y, square_scale, triangle_scale, base_angle, time) {
    let mMatrix = mat4.create();

    let twinkleFactor = Math.abs(Math.sin(time * 2.5)) * 1.0 + 0.7; 
    let color = [1, 1, 1, 1.0];

    // Draw the central square
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [center_x, center_y, 0]);
    mMatrix = mat4.scale(mMatrix, [0.8*square_scale * twinkleFactor, 0.8*square_scale * twinkleFactor, 0.1]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [center_x, center_y + square_scale * twinkleFactor, 0]);
    mMatrix = mat4.rotate(mMatrix, base_angle, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.7*triangle_scale * twinkleFactor, 1.5*triangle_scale * twinkleFactor, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [center_x + square_scale * twinkleFactor, center_y, 0]);
    mMatrix = mat4.rotate(mMatrix, base_angle + Math.PI + Math.PI / 2, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.7*triangle_scale * twinkleFactor, 1.5*triangle_scale * twinkleFactor, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [center_x, center_y - square_scale * twinkleFactor, 0]);
    mMatrix = mat4.rotate(mMatrix, base_angle + Math.PI, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.7*triangle_scale * twinkleFactor, 1.5*triangle_scale * twinkleFactor, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [center_x - square_scale * twinkleFactor, center_y, 0]);
    mMatrix = mat4.rotate(mMatrix, base_angle + Math.PI + 3 * Math.PI / 2, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.7*triangle_scale * twinkleFactor, 1.5*triangle_scale * twinkleFactor, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}
// Function to Draw Mountain
function drawMountain(translation_X, translation_Y, scale_X, scale_Y, translation_X2 = 0, translation_Y2 = 0, single = false) {
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [116/255, 80/255, 56/255, 1];
    if(single)color = [138/255, 108/255, 72/255, 1];
    mMatrix = mat4.translate(mMatrix, [translation_X, translation_Y, 0]);
    mMatrix = mat4.scale(mMatrix, [scale_X, scale_Y, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    if (!single) {
        pushMatrix(matrixStack, mMatrix);
        color = [138/255, 108/255, 72/255, 1];
        mMatrix = mat4.translate(mMatrix, [translation_X2, translation_Y2, 0]);
        mMatrix = mat4.rotate(mMatrix, 6.5, [0, 0, 1]);
        mMatrix = mat4.scale(mMatrix, [scale_X, scale_Y, 1.0]);
        drawTriangle(color, mMatrix);
        mMatrix = popMatrix(matrixStack);
    }
}

// Function to Draw Ground

function drawGround() {
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [1/255, 244/255, 117/255, 1];
    mMatrix = mat4.translate(mMatrix, [0.0, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [3.0, 1.2, 2.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

// RoadDraw Function
function drawRoad() {
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [90/255, 168/255, 46/255, 1];
    mMatrix = mat4.translate(mMatrix, [0.58, -0.8, 0]);
    mMatrix = mat4.rotate(mMatrix, 7.2, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [1.6, 2, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

// Function to draw line on the river
function drawLines(flag = false, translation_X = 0, translation_Y = 0) {
    mat4.identity(mMatrix);
    if (flag) {
        mMatrix = mat4.translate(mMatrix, [translation_X, translation_Y, 0]);
    }
    pushMatrix(matrixStack, mMatrix);
    color = [1,1,1,1];
    mMatrix = mat4.translate(mMatrix, [-0.75, -0.19, 0]);
    mMatrix = mat4.rotate(mMatrix, 4.71, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.0025, 0.35, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}
// Fucntion to Draw River
function drawRiver() {
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [1/255, 90/255, 254/255, 1];
    mMatrix = mat4.translate(mMatrix, [0.0, -0.17, 0]);
    mMatrix = mat4.scale(mMatrix, [3.0, 0.25, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    drawLines();
    drawLines(true, 0.85, 0.1);
    drawLines(true, 1.5, -0.06);
}

function drawTrees(move = false, translation_X = 0, translation_Y= 0, scale_X = 0, scale_Y = 0) {
    let mMatrix = mat4.create();
    mat4.identity(mMatrix);
    if (move) {
        mMatrix = mat4.translate(mMatrix, [translation_X, translation_Y, 0]);
        mMatrix = mat4.scale(mMatrix, [scale_X, scale_Y, 0]);
    }
    
    pushMatrix(matrixStack, mMatrix);
    color = [117/255, 67/255, 66/255, 1];
    mMatrix = mat4.translate(mMatrix, [0.57, 0.16, 0]);
    mMatrix = mat4.scale(mMatrix, [0.04, 0.4, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack,mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.02, 0.04, 1.0]);

    pushMatrix(matrixStack, mMatrix);
    color = [0/255, 142/255, 68/255, 1];
    mMatrix = mat4.translate(mMatrix, [0.55, 0.45, 0]);
    mMatrix = mat4.scale(mMatrix, [0.35, 0.3, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [67/255, 169/255, 69/255, 1];
    mMatrix = mat4.translate(mMatrix, [0.55, 0.5, 0]);
    mMatrix = mat4.scale(mMatrix, [0.375, 0.3, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [91/255, 196/255, 67/255, 1];
    mMatrix = mat4.translate(mMatrix, [0.55, 0.55, 0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.3, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
     
    mMatrix = popMatrix(matrixStack);
}

// Function to Draw Bigger/closer boat
function drawBoat(translationX) {
    mat4.identity(mMatrix);
    mMatrix = mat4.translate(mMatrix, [translationX, -0.04, 0]);

    pushMatrix(matrixStack, mMatrix);
    color = [197/255, 197/255, 197/255, 1];
    mMatrix = mat4.translate(mMatrix, [0, -0.15, 0]);
    mMatrix = mat4.scale(mMatrix, [0.18, 0.06, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.09, -0.15, 0]);
    mMatrix = mat4.rotate(mMatrix, -3.15, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.06, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.09, -0.15, 0]);
    mMatrix = mat4.rotate(mMatrix, -3.15, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.06, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mMatrix = mat4.translate(mMatrix, [0, 0.006, 0]);
    mMatrix = mat4.scale(mMatrix, [0.01, 0.25, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.04, -0.01, 0]);
    mMatrix = mat4.rotate(mMatrix, 5.9, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.005, 0.23, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [1, 0, 0, 1];
    mMatrix = mat4.translate(mMatrix, [0.105, 0.006, 0]);
    mMatrix = mat4.rotate(mMatrix, 4.72, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
} 

// Function to draw smaller boat
function drawSmallBoat(transX) {
    mat4.identity(mMatrix);
    mat4.translate(mMatrix, [transX, 0., -0.1]);

    pushMatrix(matrixStack, mMatrix);
    color = [197/255, 197/255, 197/255, 1];
    mat4.translate(mMatrix, [0, -0.1, 0]); 
    mat4.scale(mMatrix, [0.1, 0.04, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [-0.05, -0.1, 0]);
    mat4.rotate(mMatrix, -3.15, [0, 0, 1]);
    mat4.scale(mMatrix, [0.06, 0.04, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0.05, -0.1, 0]);
    mat4.rotate(mMatrix, -3.15, [0, 0, 1]);
    mat4.scale(mMatrix, [0.06, 0.04, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mat4.translate(mMatrix, [0, -0.006, 0]); 
    mat4.scale(mMatrix, [0.007, 0.15, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mat4.translate(mMatrix, [-0.03, 0, 0]);
    mat4.rotate(mMatrix, 5.9, [0, 0, 1]);
    mat4.scale(mMatrix, [0.004, 0.17, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [116/255, 43/255, 167/255, 1];
    mat4.translate(mMatrix, [0.062, 0, 0]);
    mat4.rotate(mMatrix, 4.72, [0, 0, 1]);
    mat4.scale(mMatrix, [0.12, 0.12, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

function DrawBigfan(rotationAngle){
    mat4.identity(mMatrix);

    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.68, -0.22, 0]);
    mMatrix = mat4.scale(mMatrix, [0.03, 0.6, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    
    color = [169/255, 168/255, 10/255, 1];
   // Blades
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.68, 0.062, 0]);
    mMatrix = mat4.rotate(mMatrix, rotationAngle,[0,0,1]);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.12, 0]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.26, 1.0]);
    mMatrix = mat4.rotate(mMatrix, Math.PI,[0,0,1]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, -0.12, 0]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.26, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.12, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, Math.PI/2, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.26, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.12, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, -Math.PI/2, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.26, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1];
    mMatrix = mat4.translate(mMatrix, [0, 0, 0]);
    mMatrix = mat4.scale(mMatrix, [0.028, 0.028, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    mMatrix = popMatrix(matrixStack);
    
}

// Function to draw smaller fan
function drawSmallFan(rotationAngle){
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.45, -0.16, 0]);
    mMatrix = mat4.scale(mMatrix, [0.03, 0.4, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    
    // Blades
     color = [169/255, 168/255, 10/255, 1];
     pushMatrix(matrixStack, mMatrix);
     mMatrix = mat4.translate(mMatrix, [0.45, 0.03, 0]);
     mMatrix = mat4.rotate(mMatrix, rotationAngle,[0,0,1]);
     pushMatrix(matrixStack, mMatrix);
     
     mMatrix = mat4.translate(mMatrix, [0, 0.1, 0]);
     mMatrix = mat4.scale(mMatrix, [0.08, 0.2, 1.0]);
     mMatrix = mat4.rotate(mMatrix, Math.PI,[0,0,1]);
     drawTriangle(color, mMatrix);
     mMatrix = popMatrix(matrixStack);
 
     pushMatrix(matrixStack, mMatrix);
     mMatrix = mat4.translate(mMatrix, [0, -0.1, 0]);
     mMatrix = mat4.scale(mMatrix, [0.08, 0.2, 1.0]);
     drawTriangle(color, mMatrix);
     mMatrix = popMatrix(matrixStack);
 
     pushMatrix(matrixStack, mMatrix);
     mMatrix = mat4.translate(mMatrix, [0.1, 0, 0]);
     mMatrix = mat4.rotate(mMatrix, Math.PI/2, [0, 0, 1]);
     mMatrix = mat4.scale(mMatrix, [0.08, 0.2, 1.0]);
     drawTriangle(color, mMatrix);
     mMatrix = popMatrix(matrixStack);
 
     pushMatrix(matrixStack, mMatrix);
     mMatrix = mat4.translate(mMatrix, [-0.08, 0, 0]);
     mMatrix = mat4.rotate(mMatrix, -Math.PI/2, [0, 0, 1]);
     mMatrix = mat4.scale(mMatrix, [0.08, 0.2, 1.0]);
     drawTriangle(color, mMatrix);
     mMatrix = popMatrix(matrixStack);

     color = [0,0,0,1];
     pushMatrix(matrixStack, mMatrix);
     mMatrix = mat4.translate(mMatrix, [0, 0, 0]);
     mMatrix = mat4.scale(mMatrix, [0.024, 0.024, 1.0]);
     drawCircle(color, mMatrix);
     mMatrix = popMatrix(matrixStack);
 
     mMatrix = popMatrix(matrixStack);

}

// Function to draw Bush

function drawBush(move=false, translation_X=0, translation_Y=0, s=0) {
    mat4.identity(mMatrix);
    if (move) {
        mMatrix = mat4.translate(mMatrix, [translation_X, translation_Y, 0]);
        mMatrix = mat4.scale(mMatrix, [s, s, 0]);
    }
    // Light Bush
    pushMatrix(matrixStack, mMatrix);
    color = [1/255, 168/255, 2/255, 1];
    mMatrix = mat4.translate(mMatrix, [-1, -0.55, 0]);
    mMatrix = mat4.scale(mMatrix, [0.075, 0.055, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // Dark Green Bush
    pushMatrix(matrixStack, mMatrix);
    color = [1/255, 91/255, 1/255, 1];
    mMatrix = mat4.translate(mMatrix, [-0.72, -0.55, 0]);
    mMatrix = mat4.scale(mMatrix, [0.07, 0.05, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // Medium Green Bush
    pushMatrix(matrixStack, mMatrix);
    color = [0/255, 141/255, 0/255, 1];
    mMatrix = mat4.translate(mMatrix, [-0.86, -0.53, 0]);
    mMatrix = mat4.scale(mMatrix, [0.12, 0.08, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

// Function to draw House

function drawHouse(){
    mat4.identity(mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, -0.04, 0.]);
    pushMatrix(matrixStack, mMatrix);
    color = [254/255, 67/255, 0/255, 1];
    mMatrix = mat4.translate(mMatrix, [-0.55, -0.3, 0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.2, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.75, -0.3, 0]);
    mMatrix = mat4.rotate(mMatrix, 6.285, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.25, 0.2, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.35, -0.3, 0]);
    mMatrix = mat4.rotate(mMatrix, 6.285, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.25, 0.2, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // base
    pushMatrix(matrixStack, mMatrix);
    color = [224/255, 224/255, 224/255, 1];
    mMatrix = mat4.translate(mMatrix, [-0.55, -0.525, 0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.25, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // windows
    pushMatrix(matrixStack, mMatrix);
    color = [222/255, 168/255, 0/255, 1];
    mMatrix = mat4.translate(mMatrix, [-0.7, -0.47, 0]);
    mMatrix = mat4.scale(mMatrix, [0.07, 0.07, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.4, -0.47, 0]);
    mMatrix = mat4.scale(mMatrix, [0.07, 0.07, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // door
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.55, -0.56, 0]);
    mMatrix = mat4.scale(mMatrix, [0.08, 0.15, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}
// Function to Draw Car's Wheel
function drawWheel(move = false, translation_X = 0) {
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    if (move) {
        mMatrix = mat4.translate(mMatrix, [translation_X, 0, 0]);
    }
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0, 1];
    mMatrix = mat4.translate(mMatrix, [-0.63, -0.87, 0]);
    mMatrix = mat4.scale(mMatrix, [0.04, 0.04, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [116/255, 116/255, 116/255, 1];
    mMatrix = mat4.translate(mMatrix, [-0.63, -0.87, 0]);
    mMatrix = mat4.scale(mMatrix, [0.03, 0.03, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    mMatrix = popMatrix(matrixStack);
}

// Function to draw Cars
function drawCar() {
    mMatrix = mat4.identity(mMatrix); 
    
    // pushMatrix(matrixStack,mMatrix);
    // mMatrix = mat4.translate(mMatrix, [-0.2, -0.002, 0]);

    color = [0/255, 68/255, 167/255, 1];
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.5, -0.746, 0]);
    mMatrix = mat4.scale(mMatrix, [0.132, 0.102, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [196/255, 196/255, 224/255, 1];
    mMatrix = mat4.translate(mMatrix, [-0.5, -0.751, 0]);
    mMatrix = mat4.scale(mMatrix, [0.17, 0.12, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
 
    drawWheel(true,0.04);
    drawWheel(true, 0.22);

    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [0/255, 116/255, 225/255, 1];
    mMatrix = mat4.translate(mMatrix, [-0.5, -0.8, 0]);
    mMatrix = mat4.scale(mMatrix, [0.32, 0.1, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.339, -0.8, 0]);
    mMatrix = mat4.rotate(mMatrix, 6.285, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.14, 0.1, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.662, -0.8, 0]);
    mMatrix = mat4.rotate(mMatrix, 6.285, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.14, 0.1, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // mMatrix = popMatrix(matrixStack);
}