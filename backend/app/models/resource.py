from pydantic import BaseModel


class Resources(BaseModel):
    population: int = 10
    food: int = 100
    oxygen: int = 100
    water: int = 100
    energy: int = 50
    minerals: int = 50
    tech_points: int = 0


class ResourceCapacity(BaseModel):
    population: int = 50
    food: int = 500
    oxygen: int = 500
    water: int = 500
    energy: int = 200
    minerals: int = 200
    tech_points: int = 1000
