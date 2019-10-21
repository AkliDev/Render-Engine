#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform vec3 color;

struct Material 
{
    sampler2D diffuse;
    sampler2D specular;
	sampler2D emission;
    float     shininess;
}; 

uniform Material material;

void main()
{


    FragColor = vec4(color,1.0); // set all 4 vector values to 1.0
}