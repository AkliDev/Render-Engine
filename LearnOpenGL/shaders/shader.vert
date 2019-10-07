#version 330 core

layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;
layout (location = 2) in vec2 aTexCoord;

out vec3 ourColor;
out vec2 texCoord;
out float texMix;

uniform vec3 offset;
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main()
{
   gl_Position = projection * view * model * (vec4(aPos + offset, 1.0));
   ourColor = aPos + offset + vec3( 0.5,0.5,0.5);
   texCoord = aTexCoord;
}