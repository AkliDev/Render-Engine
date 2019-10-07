#version 330 core

out vec4 FragColor;

in vec3 ourColor;
in vec2 texCoord;
in float texMix;

uniform sampler2D texture1;
uniform sampler2D texture2;
uniform float mixValue;

void main()
{

FragColor = texture(texture1, texCoord) * vec4(ourColor, 1.0f);
  
}