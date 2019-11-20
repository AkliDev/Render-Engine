#version 330 core
layout (location = 0) out vec4 FragColor;
layout (location = 1) out vec4 BrightColor;

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

in VS_LIGHTS_OUT
{
	in SpotLight SpotLight;  
	in DirLight DirLight; 
	in PointLight PointLights[NR_POINT_LIGHTS];
	in vec3 TangentLightPos [NR_POINT_LIGHTS];
} fs_lights_in;

in VS_OUT 
{
	in vec3 CameraPos;
	in vec3 TangentCameraPos;
	in vec3 FragPosView;	
	in vec3 FragPosWorld;
	in vec3 TangentFragPos;
	in vec3 NormalView;
	in vec3 NormalWorld;
	in vec2 TexCoords;
	in vec4 FragPosLightSpace;	
	in mat4 View;
} fs_in;

struct Material 
{	
    sampler2D texture_diffuse; 
	sampler2D texture_specular;
	sampler2D texture_reflection;
	sampler2D texture_normal;
	sampler2D texture_depth;

    float     shininess;
	float	  heightscale;
}; 
  
uniform Material material;
vec2 texCoords;

//for reflection
uniform samplerCube skybox;
uniform sampler2D shadowMap;
uniform samplerCube shadowCubeMap;
uniform float far_plane;

//uniform bool blinn;
bool blinn;
bool shadow;

vec3 CalcReflection(vec3 fragPos, vec3 camPos, vec3 normal)
{
	vec3 I = normalize(fragPos - camPos);
    vec3 R = reflect(I, normalize(normal));
    return vec3(texture(skybox, R).rgb);
}

float DirectionalShadowCalculation(vec4 fragPosLightSpace)
{
	// perform perspective divide
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform to [0,1] range
    projCoords = projCoords * 0.5 + 0.5;
    // get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
    float closestDepth = texture(shadowMap, projCoords.xy).r; 
    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;
    // check whether current frag pos is in shadow
	// calculate bias (based on depth map resolution and slope)
    vec3 normal = normalize(fs_in.NormalView);
    vec3 lightDir = normalize(fs_lights_in.DirLight.direction);
	float bias = max(0.05 * (1.0 - dot(fs_in.NormalView, lightDir)), 0.005);  
	
    float shadow = 0.0;
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
    for(int x = -1; x <= 1; ++x)
    {
        for(int y = -1; y <= 1; ++y)
        {
            float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r; 
            shadow += currentDepth - bias > pcfDepth  ? 1.0 : 0.0;        
        }    
    }
    shadow /= 9.0;

	if(projCoords.z > 1.0)
        shadow = 0.0;

	return shadow;
}

vec3 sampleOffsetDirections[20] = vec3[]
(
   vec3( 1,  1,  1), vec3( 1, -1,  1), vec3(-1, -1,  1), vec3(-1,  1,  1), 
   vec3( 1,  1, -1), vec3( 1, -1, -1), vec3(-1, -1, -1), vec3(-1,  1, -1),
   vec3( 1,  1,  0), vec3( 1, -1,  0), vec3(-1, -1,  0), vec3(-1,  1,  0),
   vec3( 1,  0,  1), vec3(-1,  0,  1), vec3( 1,  0, -1), vec3(-1,  0, -1),
   vec3( 0,  1,  1), vec3( 0, -1,  1), vec3( 0, -1, -1), vec3( 0,  1, -1)
);   

float OmniDirectionalShadowCalculation(vec3 fragPos, PointLight light)
{
 // get vector between fragment position and light position
    vec3 fragToLight = fragPos - light.position;
    // use the light to fragment vector to sample from the depth map    
    float closestDepth = texture(shadowCubeMap, fragToLight).r;
    // it is currently in linear range between [0,1]. Re-transform back to original value
    closestDepth *= far_plane;
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // now test for shadows    
	float shadow = 0.0;
	float bias   = 0.15;
	int samples  = 20;
	float viewDistance = length(fs_in.CameraPos - fragPos);
	float diskRadius = (1.0 + (viewDistance / far_plane)) / 25.0;  
	for(int i = 0; i < samples; ++i)
	{
	    float closestDepth = texture(shadowCubeMap, fragToLight + sampleOffsetDirections[i] * diskRadius).r;
	    closestDepth *= far_plane;   // Undo mapping [0;1]
	    if(currentDepth - bias > closestDepth)
	        shadow += 1.0;
	}

	shadow /= float(samples);       
    return shadow;
}

vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir)
{ 
    // number of depth layers
    const float minLayers = 80;
    const float maxLayers = 320;
    float numLayers = mix(maxLayers, minLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir))); 

    //calculate the size of each layer
    float layerDepth = 1.0 / numLayers;
    // depth of current layer
    float currentLayerDepth = 0.0;
    // the amount to shift the texture coordinates per layer (from vector P)
    vec2 P = viewDir.xy / viewDir.z * material.heightscale; 
    vec2 deltaTexCoords = P / numLayers;

    // get initial values
    vec2  currentTexCoords     = texCoords;
	float currentDepthMapValue = texture(material.texture_depth, currentTexCoords).r;
      
    while(currentLayerDepth < currentDepthMapValue)
    {
        // shift texture coordinates along direction of P
        currentTexCoords -= deltaTexCoords;
        // get depthmap value at current texture coordinates
        currentDepthMapValue = texture(material.texture_depth, currentTexCoords).r;  
        // get depth of next layer
        currentLayerDepth += layerDepth;  
    }

     
    // get texture coordinates before collision (reverse operations)
    vec2 prevTexCoords = currentTexCoords + deltaTexCoords;

    // get depth after and before collision for linear interpolation
    float afterDepth  = currentDepthMapValue - currentLayerDepth;
    float beforeDepth = texture(material.texture_depth, prevTexCoords).r - currentLayerDepth + layerDepth;
 
    // interpolation of texture coordinates
    float weight = afterDepth / (afterDepth - beforeDepth);
    vec2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0 - weight);

    return finalTexCoords;
}


vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir, mat4 view)
{
	vec3 lightDir = mat3(transpose(inverse(view)))*light.direction;
	lightDir = normalize(-lightDir);
	// diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
	// specular shading
	float spec = 0.0;
    if(blinn)
    {
        vec3 halfwayDir = normalize(lightDir + viewDir);  
        spec = pow(max(dot(normal, halfwayDir), 0.0), material.shininess);
    }
    else
    {
        vec3 reflectDir = reflect(-lightDir, normal);
        spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    }
	// combine results
    vec3 ambient  = light.ambient  * vec3(texture(material.texture_diffuse, fs_in.TexCoords));
    vec3 diffuse  = light.diffuse  * diff * vec3(texture(material.texture_diffuse, fs_in.TexCoords));
    vec3 specular = light.specular * spec * vec3(texture(material.texture_specular, fs_in.TexCoords));

	float shadow = DirectionalShadowCalculation(fs_in.FragPosLightSpace);   
    return (ambient + (1.0 - shadow) * (diffuse + specular));
}

vec3 CalcPointLight(PointLight light, vec3 tangentLightPos, vec3 normal, vec3 fragPos, vec3 viewDir, mat4 view)
{
	vec3 lightDir = normalize(vec3(tangentLightPos - fragPos)); // view space
	//vec3 lightDir = normalize(vec3(view * vec4(light.position, 1.0)) - fs_in.FragPosView); // view space
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    float spec = 0.0;
    if(blinn)
    {
        vec3 halfwayDir = normalize(lightDir + viewDir);  
        spec = pow(max(dot(normal, halfwayDir), 0.0), material.shininess);
    }
    else
    {
        vec3 reflectDir = reflect(-lightDir, normal);
        spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    }
    // attenuation
    float distance    = length(tangentLightPos - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));    
    // combine results
    vec3 ambient  = light.ambient  * vec3(texture(material.texture_diffuse, texCoords));
    vec3 diffuse  = light.diffuse  * diff * vec3(texture(material.texture_diffuse, texCoords));
    vec3 specular = light.specular * spec * vec3(texture(material.texture_specular, texCoords));
    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;

	float shadow = shadow ? OmniDirectionalShadowCalculation(fs_in.FragPosWorld, light) : 0.0f;          
    return (ambient + (1.0 - shadow) * (diffuse + specular));
}

// calculates the color when using a spot light.
vec3 CalcSpotLight(SpotLight light, vec3 normal, vec3 fragPos, vec3 viewDir, mat4 view)
{
    vec3 lightDir = normalize(vec3(fs_in.View * vec4(light.position, 1.0)) - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    float spec = 0.0;
    if(blinn)
    {
        vec3 halfwayDir = normalize(lightDir + viewDir);  
        spec = pow(max(dot(normal, halfwayDir), 0.0), material.shininess);
    }
    else
    {
        vec3 reflectDir = reflect(-lightDir, normal);
        spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    }
    // attenuation
    float distance = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));    
    // spotlight intensity
    float theta = dot(lightDir, normalize(-light.direction)); 
    float epsilon = light.cutOff - light.outerCutOff;
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0);
    // combine results
    vec3 ambient = light.ambient * vec3(texture(material.texture_diffuse, fs_in.TexCoords));
    vec3 diffuse = light.diffuse * diff * vec3(texture(material.texture_diffuse, fs_in.TexCoords));
    vec3 specular = light.specular * spec * vec3(texture(material.texture_specular, fs_in.TexCoords));
    ambient *= attenuation * intensity;
    diffuse *= attenuation * intensity;
    specular *= attenuation * intensity;
    return (ambient + diffuse + specular);
}

void main()
{    
	blinn = true;
	shadow = true;
	texCoords = fs_in.TexCoords;
	//discard transparant fragments	
//    if(texture(material.texture_diffuse, fs_in.TexCoords).a < 0.1 &&		
//		texture(material.texture_specular, fs_in.TexCoords).a < 0.1 &&
//		texture(material.texture_reflection, fs_in.TexCoords).a < 0.1 &&
//		texture(material.texture_normal, fs_in.TexCoords).a < 0.1)
//        discard;

//	// offset texture coordinates with Parallax Mapping
	vec3 viewDir = normalize(fs_in.TangentCameraPos - fs_in.TangentFragPos); // tangent space view direction
	texCoords = ParallaxMapping(fs_in.TexCoords,  viewDir);       
    if(texCoords.x > 1.0 || texCoords.y > 1.0 || texCoords.x < 0.0 || texCoords.y < 0.0)
        discard;

	// obtain normal from normal map in range [0,1]
    vec3 norm = normalize(texture(material.texture_normal, texCoords).rgb);
    // transform normal vector to range [-1,1]
	norm = texture(material.texture_normal, texCoords).rgb;
	norm = normalize(norm * 2.0 - 1.0); 

	////transform normal from tangent to model space
//	norm = normalize(fs_in.TBN * norm); 
	//norm.y = -norm.y;
//	norm = mat3(transpose(inverse(fs_in.View)))*norm;

	// define an output color value
	vec3 result = vec3(0.0);
	// add the directional light's contribution to the output
	//result += CalcDirLight(dirLight, norm, viewDir, fs_in.View);
	// do the same for all point lights
	for(int i = 0; i < NR_POINT_LIGHTS; i++)
  		result += CalcPointLight(fs_lights_in.PointLights[i], fs_lights_in.TangentLightPos[i], norm, fs_in.TangentFragPos, viewDir, fs_in.View);
		// phase 3: spot light
    //result += CalcSpotLight(spotLight, norm, FragPos, viewDir, View); 

	//result = CalcReflection(FragPosWorld, cameraPos, NormalWorld) + vec3(result.x,0,0);
	FragColor =  vec4(result,1);	
	//FragColor =  vec4(vec3(texture(material.texture_normal, fs_in.TexCoords)),1);	

	float brightness = dot(FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));

    if(brightness > 1.0)
        BrightColor = vec4(FragColor.rgb, 1.0);
    else
        BrightColor = vec4(0.0, 0.0, 0.0, 1.0);

	BrightColor = vec4(1.0, 0.0, 1.0, 1.0);
}