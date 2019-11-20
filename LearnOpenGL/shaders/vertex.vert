#version 330 core

layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec2 aTexCoords;
layout (location = 3) in vec3 aTangent;

struct DirLight 
{
    vec3 direction;
  
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

#define NR_POINT_LIGHTS 1 
struct PointLight 
{    
    vec3 position;
    
    float constant;
    float linear;
    float quadratic;  

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};  

struct SpotLight 
{
	vec3 position;
    vec3 direction; 
	float cutOff;
	float outerCutOff;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

	float constant;
    float linear;
    float quadratic;
};

out VS_LIGHTS_OUT
{
	out SpotLight SpotLight;  
	out DirLight DirLight; 
	out PointLight PointLights[NR_POINT_LIGHTS];
	out vec3 TangentLightPos [NR_POINT_LIGHTS];
} vs_lights_out;

out VS_OUT 
{
	out vec3 CameraPos;
	out vec3 TangentCameraPos;
	out vec3 FragPosView;	
	out vec3 FragPosWorld;
	out vec3 TangentFragPos;
	out vec3 NormalView;
	out vec3 NormalWorld;
	out vec2 TexCoords;
	out vec4 FragPosLightSpace;	
	out mat4 View;
} vs_out;

layout (std140) uniform Matrices
{
    mat4 projection;
    mat4 view;
};

uniform SpotLight spotLight;  
uniform DirLight dirLight; 
uniform PointLight pointLights[NR_POINT_LIGHTS];

uniform mat4 model;
uniform mat4 lightSpaceMatrix;

uniform vec3 cameraPos;

void main()
{
	vs_lights_out.DirLight = dirLight;
	vs_lights_out.SpotLight = spotLight;
	vs_lights_out.PointLights = pointLights;
	
	vs_out.CameraPos = cameraPos;

	vs_out.FragPosWorld = vec3(model * vec4(aPos, 1.0));
	vs_out.NormalWorld = mat3(transpose(inverse(model))) * aNormal;

    vs_out.FragPosView = vec3(view * model * vec4(aPos, 1.0));
    vs_out.NormalView = mat3(transpose(inverse(view * model))) * aNormal;

	vs_out.TexCoords = aTexCoords;
	vs_out.View = view;

	mat3 normalMatrix = mat3(transpose(inverse(view * model)));
	vs_out.FragPosLightSpace = lightSpaceMatrix * vec4(vs_out.FragPosWorld, 1.0);

	vec3 T = normalize(mat3(model) * aTangent);
    vec3 N = normalize(mat3(model) * aNormal);
	T = normalize(T - dot(T, N) * N);
	vec3 B = cross(N,T);
	B =-B;
    mat3 TBN = mat3(T, B, N);

	for(int i = 0; i < NR_POINT_LIGHTS; i++)
		vs_lights_out.TangentLightPos[i] = transpose(TBN) * vs_lights_out.PointLights[i].position;
	vs_out.TangentCameraPos  = transpose(TBN) * cameraPos;
	vs_out.TangentFragPos  =  transpose(TBN) * vs_out.FragPosWorld;

	gl_Position = projection * view * model * vec4(aPos, 1.0);  
} 