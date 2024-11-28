var gl;
var canvas;

var aPositionLocation;

var aLightLocation;

var spBuf;

var isReflect = 1;
var isShadow = 0;

var light = [-2.8, 1.8, 5.5];

const vertexShaderCode = `#version 300 es
in vec3 aPosition;

void main() {
    gl_Position =  vec4(aPosition,1.0);
}`;

const fragShaderCode = `#version 300 es
precision mediump float;

uniform vec3 uLightPosition;
uniform bool uReflect;
uniform bool uShadow;

out vec4 fragColor;

struct Sphere {
    vec3 position;
    float radius;
    vec3 color;
    float shininess;
};

vec3 calculatePhongColor(vec3 normal, vec3 lightVec, vec3 viewVec, vec3 color, float shininess) {
    vec3 ambient = 0.3 * color;
    vec3 diffuse = max(dot(normal, lightVec), 0.0) * color;
    vec3 reflectDir = reflect(-lightVec, normal);
    vec3 specular = pow(max(dot(viewVec, reflectDir), 0.0), shininess) * vec3(1.0);

    return ambient + diffuse + specular;
}

void main() {
    vec2 uv = gl_FragCoord.xy / vec2(480.0, 480.0);

    vec3 cameraPos = vec3(0.0, 0.0, 1.0);
    vec3 cameraDir = normalize(vec3(uv * 2.0 - 1.0, -1.0));
    
    vec3 lightColor = vec3(1.0, 1.0, 1.0);

    Sphere arrSphere[7];
    arrSphere[0] = Sphere(vec3(-0.1, -0.19, 0.58), 0.1, vec3(0.11, 0.71, 0.02), 15.0);
    arrSphere[1] = Sphere(vec3(0.07, -0.14, 0.51), 0.11,vec3(0.21, 0.58, 0.37), 20.0);
    arrSphere[2] = Sphere(vec3(0.20, 0.018, 0.51), 0.105, vec3(0.35, 0.78, 0.80), 25.0);
    arrSphere[3] = Sphere(vec3(0.13, 0.20, 0.42), 0.12, vec3(0.35, 0.58, 0.86), 30.0);
    arrSphere[4] = Sphere(vec3(-0.065, 0.38, 0.22), 0.15, vec3(0.0, 0.0, 1.0), 35.0);
    arrSphere[5] = Sphere(vec3(-0.35, 0.28, 0.07), 0.17, vec3(0.45, 0.13, 0.95), 40.0);
    arrSphere[6] = Sphere(vec3(-0.32, 0.05, -0.45), 0.28, vec3(0.65, 0.0, .90), 45.0);

    vec3 color = vec3(0.0);
    
    vec3 fColor = vec3(0.0);
    vec3 rayDirection = cameraDir;
    vec3 rayOrigin = cameraPos;
    bool inShadow = false;

    float minTVal = 1e6;
    int intersectingSphere = -1;

    for (int i = 0; i < 7; i++) {
        float t = 0.0;
        vec3 oc = rayOrigin - arrSphere[i].position;
        float a = dot(rayDirection, rayDirection);
        float b = 2.0 * dot(oc, rayDirection);
        float c = dot(oc, oc) - arrSphere[i].radius * arrSphere[i].radius;
        float discr = b * b - 4.0 * a * c;

        if (discr >= 0.0) {
            float root1 = (-b - sqrt(discr)) / (2.0 * a);
            float root2 = (-b + sqrt(discr)) / (2.0 * a);

            t = min(root1, root2);
        }
        if (t > 0.0  && t < minTVal) {
            minTVal = t;
            intersectingSphere = i;
        }
    }    

    vec3 intersectionPoint = rayOrigin + minTVal * rayDirection;        
    
    vec3 viewVec = normalize(cameraPos - intersectionPoint);
    vec3 lightVec = normalize(uLightPosition - intersectionPoint);
    vec3 normal = normalize(intersectionPoint - arrSphere[intersectingSphere].position);
    vec3 reflectionVec = reflect(rayDirection, normal);

    fColor += calculatePhongColor(normal, lightVec, viewVec, arrSphere[intersectingSphere].color, arrSphere[intersectingSphere].shininess);
    
    if (uShadow) {
        for (int i = 0; i < 7; i++) {
            if (i == intersectingSphere) continue;

            float t=0.0;
            vec3 oc = intersectionPoint - arrSphere[i].position;
            float a = dot(lightVec, lightVec);
            float b = 2.0 * dot(oc, lightVec);
            float c = dot(oc, oc) - arrSphere[i].radius * arrSphere[i].radius;
            float discr = b * b - 4.0 * a * c;

            if (discr >= 0.0) {
                float root1 = (-b - sqrt(discr)) / (2.0 * a);
                float root2 = (-b + sqrt(discr)) / (2.0 * a);

                t =  min(root1, root2);
            }
            if (t > 0.0) {
                inShadow = true;
            }
        }
        if(inShadow) fColor *= vec3(0.2);
    }

    if (uReflect) {
    vec3 reflectColor = vec3(0.0, 0.0, 0.0);
        rayOrigin = intersectionPoint + 0.001 * normal;
        rayDirection = reflectionVec;

        float minTVal = 1e6;
        int intersectingSphere = -1;

        for (int i = 0; i < 7; i++) {
            float t = 0.0;
            vec3 oc = rayOrigin - arrSphere[i].position;
            float a = dot(rayDirection, rayDirection);
            float b = 2.0 * dot(oc, rayDirection);
            float c = dot(oc, oc) - arrSphere[i].radius * arrSphere[i].radius;
            float discr = b * b - 4.0 * a * c;

            if (discr >= 0.0) {
                float root1 = (-b - sqrt(discr)) / (2.0 * a);
                float root2 = (-b + sqrt(discr)) / (2.0 * a);

                t = min(root1, root2);
            }  
            if (t > 0.0  && t < minTVal) {
                minTVal = t;
                intersectingSphere = i;
            }
        }    

        vec3 intersectionPoint = rayOrigin + minTVal * rayDirection;        
        
        vec3 viewVec = normalize(cameraPos - intersectionPoint);
        vec3 lightVec = normalize(uLightPosition - intersectionPoint);
        vec3 normal = normalize(intersectionPoint - arrSphere[intersectingSphere].position);
        vec3 reflectionVec = reflect(rayDirection, normal);

        if(minTVal <= 1e6 && intersectingSphere != -1) 
        fColor += calculatePhongColor(normal, lightVec, viewVec, arrSphere[intersectingSphere].color, arrSphere[intersectingSphere].shininess);
        }

    fragColor = vec4(fColor, 1.0);
}` ;

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
    } catch (e) { }
    if (!gl) {
        alert("WebGL initialization failed");
    }
}

function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniform3fv(aLightLocation, light);
    gl.uniform1i(uReflectLocation, isReflect);
    gl.uniform1i(uShadowLocation, isShadow);

    spBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
    var vertices = [
        -1.0, -1.0,
        1.0, -1.0,
        -1.0, 1.0,
        1.0, 1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
    gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function onlyPhong() {
    isReflect = 0;
    isShadow = 0;
    drawScene();
}

function phongAndShadow() {
    isReflect = 0;
    isShadow = 1;
    drawScene();
}

function phongAndReflection() {
    isReflect = 1;
    isShadow = 0;
    drawScene();
}

function phongShadowAndReflection() {
    isReflect = 1;
    isShadow = 1;
    drawScene();
}

function changeLightPosition(value) {
    document.getElementById('LightSourcePosition').innerHTML = value;
    light[0] = value;
    drawScene();
}

function webGLStart() {
    canvas = document.getElementById("assignment5");
    initGL(canvas);
    shaderProgram = initShaders();

    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aLightLocation = gl.getUniformLocation(shaderProgram, "uLightPosition");
    uReflectLocation = gl.getUniformLocation(shaderProgram, "uReflect");
    uShadowLocation = gl.getUniformLocation(shaderProgram, "uShadow");

    gl.enableVertexAttribArray(aPositionLocation);

    drawScene();
}