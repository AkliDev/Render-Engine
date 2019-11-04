#version 330 core

out vec4 FragColor;

//for light calculations in view space
in vec3 FragPos;
in vec3 Normal;

//for reflection calculations in world space
in vec3 FragPosWorld;
in vec3 NormalWorld;

in vec2 TexCoords;
in mat4 View;

struct Material 
{
    sampler2D diffuse;
    sampler2D specular;
	sampler2D reflection;
    float     shininess;
}; 

struct DirLight {
    vec3 direction;
  
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

struct PointLight {    
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
  

uniform vec3 objectColor;
uniform Material material;
uniform SpotLight spotLight;  
uniform DirLight dirLight;
#define NR_POINT_LIGHTS 1  
uniform PointLight pointLights[NR_POINT_LIGHTS];

//for reflection
uniform vec3 cameraPos;
uniform samplerCube skybox;


// function prototypes
vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir);
vec3 CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir, mat4 view);
vec3 CalcSpotLight(SpotLight light, vec3 normal, vec3 fragPos, vec3 viewDir, mat4 view);
vec3 CalcReflection(vec3 fragPos, vec3 camPos, vec3 normal);

void main()
{    
//	//discard transparant fragments
//	vec4 texColor = texture(material.diffuse, TexCoords);
//    if(texColor.a < 0.0)
//        discard;

    vec3 norm = normalize(Normal);

	//We calculate the view direction in viewspace so our view direction is always the offset of the fragment
    vec3 viewDir = normalize(-FragPos);
	// define an output color value
	vec3 result = vec3(0.0);
	// add the directional light's contribution to the output
	result += CalcDirLight(dirLight, norm, viewDir);
	// do the same for all point lights
	for(int i = 0; i < NR_POINT_LIGHTS; i++)
  		result += CalcPointLight(pointLights[i], norm,FragPos,viewDir, View);
		// phase 3: spot light
    result += CalcSpotLight(spotLight, norm, FragPos, viewDir, View); 

	vec3 col = CalcReflection(FragPosWorld, cameraPos, NormalWorld);

	result += col;
	FragColor =  vec4(result,1);
	
}

vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir)
{
	vec3 lightDir = normalize(-light.direction);
	// diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
	// specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
	float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
	// combine results
    vec3 ambient  = light.ambient  * vec3(texture(material.diffuse, TexCoords));
    vec3 diffuse  = light.diffuse  * diff * vec3(texture(material.diffuse, TexCoords));
    vec3 specular = light.specular * spec * vec3(texture(material.specular, TexCoords));
    return (ambient + diffuse + specular);
}

vec3 CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir, mat4 view)
{
	vec3 lightDir = normalize(vec3(view * vec4(light.position, 1.0)) - FragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    // attenuation
    float distance    = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));    
    // combine results
    vec3 ambient  = light.ambient  * vec3(texture(material.diffuse, TexCoords));
    vec3 diffuse  = light.diffuse  * diff * vec3(texture(material.diffuse, TexCoords));
    vec3 specular = light.specular * spec * vec3(texture(material.specular, TexCoords));
    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;
    return (ambient + diffuse + specular);
}

// calculates the color when using a spot light.
vec3 CalcSpotLight(SpotLight light, vec3 normal, vec3 fragPos, vec3 viewDir, mat4 view)
{
    vec3 lightDir = normalize(vec3(View * vec4(light.position, 1.0)) - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    // attenuation
    float distance = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));    
    // spotlight intensity
    float theta = dot(lightDir, normalize(-light.direction)); 
    float epsilon = light.cutOff - light.outerCutOff;
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0);
    // combine results
    vec3 ambient = light.ambient * vec3(texture(material.diffuse, TexCoords));
    vec3 diffuse = light.diffuse * diff * vec3(texture(material.diffuse, TexCoords));
    vec3 specular = light.specular * spec * vec3(texture(material.specular, TexCoords));
    ambient *= attenuation * intensity;
    diffuse *= attenuation * intensity;
    specular *= attenuation * intensity;
    return (ambient + diffuse + specular);
}

vec3 CalcReflection(vec3 fragPos, vec3 camPos, vec3 normal)
{
	vec3 I = normalize(fragPos - camPos);
    vec3 R = reflect(I, normalize(normal));
    return vec3(texture(skybox, R).rgb);
}